import { env } from "../../config/env.js";
import type { LLMProvider } from "./llm-provider.js";
import { OpenRouterProvider } from "./openrouter.provider.js";
import { GeminiProvider } from "./gemini.provider.js";

export type { ChatMessage, LLMProvider } from "./llm-provider.js";
export { LLMError } from "./llm-provider.js";

let cached: LLMProvider | undefined;

/** Returns the configured provider, instantiated once and reused. */
export function getLLMProvider(): LLMProvider {
  if (!cached) {
    cached = createProvider();
  }
  return cached;
}

function createProvider(): LLMProvider {
  switch (env.LLM_PROVIDER) {
    case "openrouter":
      return new OpenRouterProvider();
    case "gemini":
      return new GeminiProvider();
    case "anthropic":
      throw new Error("The Anthropic provider is not available yet.");
  }
}
