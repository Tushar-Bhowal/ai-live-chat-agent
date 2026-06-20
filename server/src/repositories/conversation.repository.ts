import { prisma } from "../db/client.js";
import type { Conversation } from "../generated/prisma/client.js";

// Repositories are the only layer that touches Prisma; services depend on these.
export const conversationRepository = {
  findById(id: string): Promise<Conversation | null> {
    return prisma.conversation.findUnique({ where: { id } });
  },

  create(input: { channel: string }): Promise<Conversation> {
    return prisma.conversation.create({ data: { channel: input.channel } });
  },
};
