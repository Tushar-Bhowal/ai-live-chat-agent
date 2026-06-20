import { conversationRepository } from "../../repositories/conversation.repository.js";
import { messageRepository } from "../../repositories/message.repository.js";
import type { Conversation, Message } from "../../generated/prisma/client.js";
import { DEFAULT_CHANNEL } from "../channels/channel.js";
import { buildSystemPrompt } from "../knowledge/knowledge.service.js";
import { getLLMProvider } from "../llm/index.js";
import type { ChatMessage } from "../llm/index.js";
import { tools } from "../tools/tool.js";

export const MAX_MESSAGE_LENGTH = 4000;

// Coarse cap on how many recent messages we pull from the DB before trimming.
const HISTORY_FETCH_LIMIT = 50;

// Token budget for the history we actually send. A count-based cap can't bound
// cost (one message can be 1 token or thousands), so we trim by estimated tokens
// to keep the prompt and spend within a known ceiling.
const HISTORY_TOKEN_BUDGET = 1500;

export class InvalidMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMessageError";
  }
}

export interface IncomingMessage {
  channel?: string;
  // The conversation id; a new conversation starts when absent or unknown.
  sessionId?: string;
  text: string;
}

export interface AgentReply {
  reply: string;
  sessionId: string;
}

// Channel-agnostic core: every channel funnels through here, so persistence,
// context, and the model call live in one place.
export async function handleIncomingMessage(
  input: IncomingMessage,
): Promise<AgentReply> {
  const text = input.text.trim();
  if (!text) {
    throw new InvalidMessageError("message is required");
  }
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new InvalidMessageError(
      `message too long (max ${MAX_MESSAGE_LENGTH} chars)`,
    );
  }

  const conversation = await resolveConversation(
    input.sessionId,
    input.channel ?? DEFAULT_CHANNEL,
  );

  await messageRepository.create({
    conversationId: conversation.id,
    sender: "user",
    text,
  });

  const recent = await messageRepository.findRecent(
    conversation.id,
    HISTORY_FETCH_LIMIT,
  );
  const history = selectWithinTokenBudget(recent, HISTORY_TOKEN_BUDGET);
  const systemPrompt = await buildSystemPrompt();

  // The provider runs the tool-calling loop with whatever tools we pass; the
  // agent just decides which tools are available for this turn.
  const reply = await getLLMProvider().generateReply(
    systemPrompt,
    toChatHistory(history),
    tools,
  );

  await messageRepository.create({
    conversationId: conversation.id,
    sender: "ai",
    text: reply,
  });

  return { reply, sessionId: conversation.id };
}

// Reuse a known conversation, otherwise start a new one.
async function resolveConversation(
  sessionId: string | undefined,
  channel: string,
): Promise<Conversation> {
  if (sessionId) {
    const existing = await conversationRepository.findById(sessionId);
    if (existing) {
      return existing;
    }
  }
  return conversationRepository.create({ channel });
}

// ~4 characters per token is a provider-agnostic approximation. This is a budget
// guard, not exact accounting, so we avoid coupling to a vendor-specific tokenizer.
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4) + 4;
}

// Keep the newest messages whose combined estimate fits the budget (always at
// least the latest one), returned in chronological order.
function selectWithinTokenBudget(
  messages: Message[],
  budget: number,
): Message[] {
  const kept: Message[] = [];
  let total = 0;
  for (const message of [...messages].reverse()) {
    const cost = estimateTokens(message.text);
    if (kept.length > 0 && total + cost > budget) break;
    total += cost;
    kept.push(message);
  }
  kept.reverse();
  return kept;
}

// Map stored messages to the provider's neutral role/content shape.
function toChatHistory(messages: Message[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.sender === "ai" ? "assistant" : message.sender,
    content: message.text,
  }));
}
