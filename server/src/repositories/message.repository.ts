import { prisma } from "../db/client.js";
import type { Message } from "../generated/prisma/client.js";
import type { Sender } from "../generated/prisma/enums.js";

export const messageRepository = {
  create(input: {
    conversationId: string;
    sender: Sender;
    text: string;
  }): Promise<Message> {
    return prisma.message.create({ data: input });
  },

  // Last `limit` messages, oldest first, for the LLM history window.
  async findRecent(conversationId: string, limit: number): Promise<Message[]> {
    const rows = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse();
  },

  // Full transcript, oldest first, to restore a conversation on reload.
  listByConversation(conversationId: string): Promise<Message[]> {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  },
};
