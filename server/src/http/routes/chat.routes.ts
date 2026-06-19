import { Router } from "express";
import { z } from "zod";
import {
  handleIncomingMessage,
  MAX_MESSAGE_LENGTH,
} from "../../domain/agent/agent.service.js";
import { messageRepository } from "../../repositories/message.repository.js";

const SendMessageSchema = z.object({
  message: z
    .string({ error: "message is required" })
    .trim()
    .min(1, "message is required")
    .max(MAX_MESSAGE_LENGTH, `message too long (max ${MAX_MESSAGE_LENGTH} chars)`),
  sessionId: z.string().trim().min(1).optional(),
});

export const chatRouter = Router();

/**
 * The live-chat adapter: validate, hand off to the channel-agnostic agent, and
 * return its reply. Errors propagate to the central handler.
 */
chatRouter.post("/message", async (req, res) => {
  const { message, sessionId } = SendMessageSchema.parse(req.body);
  const result = await handleIncomingMessage({
    channel: "livechat",
    sessionId,
    text: message,
  });
  res.json(result);
});

/** Returns a conversation's transcript so the widget can restore it on reload. */
chatRouter.get("/:sessionId/messages", async (req, res) => {
  const sessionId = z.string().min(1).parse(req.params.sessionId);
  const messages = await messageRepository.listByConversation(sessionId);
  res.json({
    messages: messages.map((message) => ({
      sender: message.sender,
      text: message.text,
      createdAt: message.createdAt.toISOString(),
    })),
  });
});
