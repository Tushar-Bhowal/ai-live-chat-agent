import { prisma } from "../db/client.js";
import type { Faq } from "../generated/prisma/client.js";

/**
 * Data access for FAQ entries. The repository layer is the only place that
 * talks to Prisma.
 */
export const faqRepository = {
  list(): Promise<Faq[]> {
    return prisma.faq.findMany({ orderBy: { topic: "asc" } });
  },
};
