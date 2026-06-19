import { prisma } from "../db/client.js";
import type { Conversation } from "../generated/prisma/client.js";

/**
 * Data access for conversations. The repository layer is the only place that
 * talks to Prisma; services depend on these methods, never on the client.
 */
export const conversationRepository = {
  findById(id: string): Promise<Conversation | null> {
    return prisma.conversation.findUnique({ where: { id } });
  },

  create(input: { channel: string }): Promise<Conversation> {
    return prisma.conversation.create({ data: { channel: input.channel } });
  },
};
