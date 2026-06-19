import { getLLMProvider } from "../src/domain/llm/index.js";

/** Sends one real request to the configured provider to confirm it works. */
async function main(): Promise<void> {
  const llm = getLLMProvider();
  const reply = await llm.generateReply(
    "You are a friendly e-commerce support assistant. Keep replies short.",
    [{ role: "user", content: "Hi! Do you ship internationally?" }],
  );
  console.log("Model reply:\n" + reply);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
