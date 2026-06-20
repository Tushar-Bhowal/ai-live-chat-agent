import type { Tool } from "../tools/tool.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * The boundary between the agent and any specific model vendor. Swapping
 * providers means implementing this interface and nothing else; callers stay
 * vendor-agnostic.
 */
export interface LLMProvider {
  /**
   * Returns the assistant's reply, or throws an {@link LLMError} on failure.
   * When `tools` are supplied, the provider runs the tool-calling loop
   * (request -> execute -> feed back) internally, so callers never deal with a
   * vendor's tool-call format.
   */
  generateReply(
    systemPrompt: string,
    history: ChatMessage[],
    tools?: Tool[],
  ): Promise<string>;
}

export type LLMErrorKind =
  | "timeout"
  | "auth"
  | "rate_limit"
  | "network"
  | "empty_response"
  | "unknown";

/**
 * A vendor-neutral failure. Provider implementations classify their own errors
 * into one of these kinds so callers can react (and log) without knowing which
 * SDK produced them.
 */
export class LLMError extends Error {
  readonly kind: LLMErrorKind;

  constructor(kind: LLMErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LLMError";
    this.kind = kind;
  }
}
