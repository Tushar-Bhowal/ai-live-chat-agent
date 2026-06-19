import "dotenv/config";
import { z } from "zod";

/**
 * Validates configuration once at startup so the process fails immediately with
 * a clear message instead of crashing mid-request on a missing value.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGIN: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  LLM_PROVIDER: z.enum(["openrouter", "anthropic"]).default("openrouter"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
});

function fail(lines: string[]): never {
  console.error(
    ["Invalid environment configuration:", ...lines.map((l) => `  - ${l}`)].join(
      "\n",
    ),
  );
  process.exit(1);
}

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    fail(
      parsed.error.issues.map(
        (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
      ),
    );
  }
  const env = parsed.data;

  // The required key depends on which provider is active.
  const missing: string[] = [];
  if (env.LLM_PROVIDER === "openrouter") {
    if (!env.OPENROUTER_API_KEY) missing.push("OPENROUTER_API_KEY is required");
    if (!env.OPENROUTER_MODEL) missing.push("OPENROUTER_MODEL is required");
  } else if (env.LLM_PROVIDER === "anthropic") {
    if (!env.ANTHROPIC_API_KEY) missing.push("ANTHROPIC_API_KEY is required");
  }
  if (missing.length > 0) {
    fail([`for LLM_PROVIDER=${env.LLM_PROVIDER}:`, ...missing]);
  }

  return env;
}

export const env = loadEnv();
export type Env = typeof env;
