import { prisma } from "../db/client.js";
import type { Faq } from "../generated/prisma/client.js";

export const faqRepository = {
  list(): Promise<Faq[]> {
    return prisma.faq.findMany({ orderBy: { topic: "asc" } });
  },
};
