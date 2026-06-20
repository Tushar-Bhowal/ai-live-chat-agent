import { conversationRepository } from "../../repositories/conversation.repository.js";
import { messageRepository } from "../../repositories/message.repository.js";
import type { Conversation, Message } from "../../generated/prisma/client.js";
import { DEFAULT_CHANNEL } from "../channels/channel.js";
import { buildSystemPrompt } from "../knowledge/knowledge.service.js";
import { getLLMProvider } from "../llm/index.js";
import type { ChatMessage } from "../llm/index.js";
import { tools } from "../tools/tool.js";

export const MAX_MESSAGE_LENGTH = 4000;

// Recent messages sent as context, to bound prompt size and cost.
const HISTORY_LIMIT = 10;

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

  const history = await messageRepository.findRecent(
    conversation.id,
    HISTORY_LIMIT,
  );
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

// Map stored messages to the provider's neutral role/content shape.
function toChatHistory(messages: Message[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.sender === "ai" ? "assistant" : message.sender,
    content: message.text,
  }));
}
