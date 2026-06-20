import { GoogleGenAI } from "@google/genai";
import type { Content, FunctionDeclaration, Schema } from "@google/genai";
import { env } from "../../config/env.js";
import { LLMError } from "./llm-provider.js";
import type { ChatMessage, LLMProvider } from "./llm-provider.js";
import type { Tool } from "../tools/tool.js";

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 500;
const MAX_TOOL_ROUNDS = 4;

// Gemini's SDK differs from the OpenAI shape (user/model roles, a separate
// systemInstruction, its own function-calling format) but satisfies the same
// interface, so nothing outside this file knows the difference.
export class GeminiProvider implements LLMProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor() {
    if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL) {
      throw new Error("Gemini configuration is incomplete.");
    }
    this.client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    this.model = env.GEMINI_MODEL;
  }

  async generateReply(
    systemPrompt: string,
    history: ChatMessage[],
    tools: Tool[] = [],
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const contents: Content[] = history.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

    const config = {
      systemInstruction: systemPrompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.3,
      abortSignal: controller.signal,
      ...(tools.length
        ? { tools: [{ functionDeclarations: toFunctionDeclarations(tools) }] }
        : {}),
    };

    try {
      // Loop so the model can call tools, see the results, then answer.
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const response = await this.client.models.generateContent({
          model: this.model,
          contents,
          config,
        });

        const calls = response.functionCalls ?? [];
        if (calls.length === 0) {
          const reply = response.text?.trim();
          if (!reply) {
            throw new LLMError("empty_response", "The model returned no content.");
          }
          return reply;
        }

        // Echo the model's turn back verbatim. On thinking models the parts
        // carry a thought_signature that must be preserved for the follow-up
        // tool call to be accepted, so reuse the content rather than rebuild it.
        const modelContent = response.candidates?.[0]?.content;
        contents.push(
          modelContent ?? {
            role: "model",
            parts: calls.map((call) => ({ functionCall: call })),
          },
        );
        const resultParts = [];
        for (const call of calls) {
          resultParts.push({
            functionResponse: {
              name: call.name ?? "",
              response: await runTool(tools, call.name, call.args),
            },
          });
        }
        contents.push({ role: "user", parts: resultParts });
      }

      throw new LLMError(
        "unknown",
        "The model kept requesting tools without answering.",
      );
    } catch (error) {
      throw toLLMError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Gemini's schema uses uppercase type names and a subset of JSON Schema fields,
// so translate the tool's JSON Schema rather than passing it through verbatim.
function toFunctionDeclarations(tools: Tool[]): FunctionDeclaration[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: toGeminiSchema(tool.parameters) as Schema,
  }));
}

function toGeminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof schema["type"] === "string") {
    out["type"] = schema["type"].toUpperCase();
  }
  if (schema["description"]) out["description"] = schema["description"];
  if (schema["enum"]) out["enum"] = schema["enum"];
  if (schema["required"]) out["required"] = schema["required"];

  const properties = schema["properties"];
  if (properties && typeof properties === "object") {
    out["properties"] = Object.fromEntries(
      Object.entries(properties as Record<string, Record<string, unknown>>).map(
        ([key, value]) => [key, toGeminiSchema(value)],
      ),
    );
  }
  const items = schema["items"];
  if (items && typeof items === "object") {
    out["items"] = toGeminiSchema(items as Record<string, unknown>);
  }
  return out;
}

async function runTool(
  tools: Tool[],
  name: string | undefined,
  args: Record<string, unknown> | undefined,
): Promise<Record<string, unknown>> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    return { error: `Unknown tool: ${name}` };
  }
  const result = await tool.execute(args ?? {});
  try {
    const parsed = JSON.parse(result) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through to wrapping the raw string
  }
  return { result };
}

function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;
  if (error instanceof Error && error.name === "AbortError") {
    return new LLMError("timeout", "The model request timed out.", {
      cause: error,
    });
  }

  const status = (error as { status?: number }).status;
  const message = error instanceof Error ? error.message : String(error);

  if (status === 401 || status === 403 || /api key/i.test(message)) {
    return new LLMError("auth", "The model provider rejected the API key.", {
      cause: error,
    });
  }
  if (status === 429 || /quota|rate limit/i.test(message)) {
    return new LLMError(
      "rate_limit",
      "The model provider is rate limiting requests.",
      { cause: error },
    );
  }
  if (/network|fetch failed|ENOTFOUND|ECONN/i.test(message)) {
    return new LLMError("network", "Could not reach the model provider.", {
      cause: error,
    });
  }
  return new LLMError(
    "unknown",
    "An unexpected error occurred while contacting the model.",
    { cause: error },
  );
}
