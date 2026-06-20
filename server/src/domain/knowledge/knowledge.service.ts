import { faqRepository } from "../../repositories/faq.repository.js";

/**
 * The agent's persona and guardrails. Kept separate from the store's policies
 * (which live in the FAQ table) so tone can be tuned without touching data.
 */
const PERSONA = [
  "You are a warm, concise customer-support agent for an online store.",
  "Answer using only the information in the knowledge base below.",
  "If a question isn't covered there, say you're not certain and offer to connect the customer with a human teammate — never invent policies, prices, or delivery promises.",
  "When a customer asks about a specific order, use the available tools to look it up by its order id rather than guessing.",
  "Keep replies friendly and to the point, the way a helpful support chat would.",
  "Light Markdown (bold, the occasional short list) is fine; avoid headings, tables, and code blocks.",
].join("\n");

/**
 * Builds the system prompt from the current FAQ rows at request time, so
 * updating store policies is a data change rather than a code change.
 */
export async function buildSystemPrompt(): Promise<string> {
  const faqs = await faqRepository.list();
  const knowledge = faqs.length
    ? faqs.map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`).join("\n\n")
    : "(No knowledge base entries are available.)";

  return `${PERSONA}\n\nKnowledge base:\n${knowledge}`;
}
