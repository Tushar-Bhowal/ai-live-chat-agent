import { prisma } from "../db/client.js";
import type { Message } from "../generated/prisma/client.js";
import type { Sender } from "../generated/prisma/enums.js";

/**
 * Data access for messages. The repository layer is the only place that talks
 * to Prisma.
 */
export const messageRepository = {
  create(input: {
    conversationId: string;
    sender: Sender;
    text: string;
  }): Promise<Message> {
    return prisma.message.create({ data: input });
  },

  /**
   * Most recent `limit` messages for a conversation, returned oldest → newest
   * so they can be passed straight to the LLM as history. Bounding the window
   * keeps prompt size and token cost in check.
   */
  async findRecent(conversationId: string, limit: number): Promise<Message[]> {
    const rows = await prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.reverse();
  },

  /** Full transcript in chronological order, used to restore a conversation. */
  listByConversation(conversationId: string): Promise<Message[]> {
    return prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  },
};
