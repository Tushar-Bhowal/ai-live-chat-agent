import type { Tool } from "../tools/tool.js";

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// The boundary between the agent and any model vendor. Swapping providers means
// implementing this interface and nothing else.
export interface LLMProvider {
  // Returns the reply, or throws an LLMError. When tools are passed, the
  // provider runs the tool-calling loop internally so callers never see a
  // vendor's tool-call format.
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

// Vendor-neutral failure: each provider maps its SDK's errors to a kind so
// callers can react and log without knowing which SDK produced them.
export class LLMError extends Error {
  readonly kind: LLMErrorKind;

  constructor(kind: LLMErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "LLMError";
    this.kind = kind;
  }
}
