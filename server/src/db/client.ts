import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env.js";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Prisma client singleton.
 *
 * The client talks to Postgres through a node-postgres driver adapter built
 * from DATABASE_URL. Caching the instance on `globalThis` keeps hot-reloads in
 * development from opening a new connection pool on every change; in production
 * the module is evaluated once.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
