import OpenAI from "openai";
import { env } from "../../config/env.js";
import { LLMError } from "./llm-provider.js";
import type { ChatMessage, LLMProvider } from "./llm-provider.js";
import type { Tool } from "../tools/tool.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 500;
// Bounds how many times the model may call tools before it must answer.
const MAX_TOOL_ROUNDS = 4;

// Uses the OpenAI-compatible API, so the model is just a config string.
export class OpenRouterProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    // Env validation guarantees these; the guard keeps the types non-optional.
    if (!env.OPENROUTER_API_KEY || !env.OPENROUTER_MODEL) {
      throw new Error("OpenRouter configuration is incomplete.");
    }
    this.client = new OpenAI({
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: OPENROUTER_BASE_URL,
      // One quick retry for transient blips; more would risk outrunning the
      // request timeout and surface as a confusing "timeout" instead of the
      // real cause (e.g. an upstream rate limit).
      maxRetries: 1,
    });
    this.model = env.OPENROUTER_MODEL;
  }

  async generateReply(
    systemPrompt: string,
    history: ChatMessage[],
    tools: Tool[] = [],
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // The neutral ChatMessage shape maps 1:1 onto the SDK's message param.
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...(history as OpenAI.Chat.ChatCompletionMessageParam[]),
    ];
    const toolParams = tools.length ? toToolParams(tools) : undefined;

    try {
      // Loop so the model can call tools, see the results, then answer.
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const completion = await this.client.chat.completions.create(
          {
            model: this.model,
            max_tokens: MAX_OUTPUT_TOKENS,
            temperature: 0.3,
            messages,
            ...(toolParams ? { tools: toolParams } : {}),
          },
          { signal: controller.signal },
        );

        const message = completion.choices[0]?.message;
        if (!message) {
          throw new LLMError("empty_response", "The model returned no content.");
        }

        const toolCalls = (message.tool_calls ?? []).filter(
          (call) => call.type === "function",
        );
        if (toolCalls.length === 0) {
          const reply = message.content?.trim();
          if (!reply) {
            throw new LLMError(
              "empty_response",
              "The model returned no content.",
            );
          }
          return reply;
        }

        // Record the model's tool request, then append each tool's result.
        messages.push(message);
        for (const call of toolCalls) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: await runTool(tools, call.function.name, call.function.arguments),
          });
        }
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

function toToolParams(tools: Tool[]): OpenAI.Chat.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

async function runTool(
  tools: Tool[],
  name: string,
  rawArgs: string,
): Promise<string> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: "Invalid tool arguments." });
  }
  return tool.execute(args);
}

function toLLMError(error: unknown): LLMError {
  if (error instanceof LLMError) return error;

  if (error instanceof OpenAI.APIUserAbortError) {
    return new LLMError("timeout", "The model request timed out.", {
      cause: error,
    });
  }
  if (error instanceof OpenAI.APIConnectionTimeoutError) {
    return new LLMError("timeout", "The model request timed out.", {
      cause: error,
    });
  }
  if (error instanceof OpenAI.AuthenticationError) {
    return new LLMError("auth", "The model provider rejected the API key.", {
      cause: error,
    });
  }
  if (error instanceof OpenAI.PermissionDeniedError) {
    return new LLMError("auth", "The API key lacks access to this model.", {
      cause: error,
    });
  }
  if (error instanceof OpenAI.RateLimitError) {
    return new LLMError(
      "rate_limit",
      "The model provider is rate limiting requests.",
      { cause: error },
    );
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return new LLMError("network", "Could not reach the model provider.", {
      cause: error,
    });
  }
  if (error instanceof OpenAI.APIError) {
    return new LLMError(
      "unknown",
      `The model provider returned an error (status ${error.status ?? "unknown"}).`,
      { cause: error },
    );
  }
  return new LLMError(
    "unknown",
    "An unexpected error occurred while contacting the model.",
    { cause: error },
  );
}
