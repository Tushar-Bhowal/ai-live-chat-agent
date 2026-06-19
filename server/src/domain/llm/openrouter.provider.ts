import OpenAI from "openai";
import { env } from "../../config/env.js";
import { LLMError } from "./llm-provider.js";
import type { ChatMessage, LLMProvider } from "./llm-provider.js";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 500;

/**
 * Talks to models hosted on OpenRouter through its OpenAI-compatible API. The
 * model is configurable per environment, so cost/quality can be tuned without
 * code changes.
 */
export class OpenRouterProvider implements LLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor() {
    // Env validation already guarantees these; the guard keeps types honest.
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
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const completion = await this.client.chat.completions.create(
        {
          model: this.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.3,
          // The neutral ChatMessage shape maps 1:1 onto the SDK's message param.
          messages: [
            { role: "system", content: systemPrompt },
            ...history,
          ] as OpenAI.Chat.ChatCompletionMessageParam[],
        },
        { signal: controller.signal },
      );

      const reply = completion.choices[0]?.message?.content?.trim();
      if (!reply) {
        throw new LLMError("empty_response", "The model returned no content.");
      }
      return reply;
    } catch (error) {
      throw toLLMError(error);
    } finally {
      clearTimeout(timeout);
    }
  }
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
