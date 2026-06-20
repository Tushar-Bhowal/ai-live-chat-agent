import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // This config is only used by the Prisma CLI (migrations, studio), so it
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
