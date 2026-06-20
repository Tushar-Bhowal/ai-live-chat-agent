import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

// Seeds the FAQ knowledge base the agent answers from. Idempotent: clears the
// table first so re-running yields a known set.
const connectionString = process.env["DATABASE_URL"];
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const faqs: { topic: string; question: string; answer: string }[] = [
  {
    topic: "shipping",
    question: "Where do you ship and how long does delivery take?",
    answer:
      "We ship worldwide. Domestic orders arrive in 3–5 business days, and international orders take 7–14 business days. You'll get a tracking link by email as soon as your order ships.",
  },
  {
    topic: "returns",
    question: "What is your return and refund policy?",
    answer:
      "You can return any item within 30 days of delivery for a full refund, as long as it's unused and in its original packaging. Once we receive the return, refunds are issued to your original payment method within 5–7 business days.",
  },
  {
    topic: "support_hours",
    question: "When is your support team available?",
    answer:
      "Our support team is available Monday to Friday, 9:00 AM to 6:00 PM IST. Messages sent outside these hours are answered the next business day.",
  },
  {
    topic: "order_tracking",
    question: "How can I track my order?",
    answer:
      "When your order ships we email you a tracking link. You can also find it under Order History in your account. If the tracking hasn't updated in 48 hours, reach out and we'll look into it.",
  },
  {
    topic: "payment",
    question: "Which payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards, UPI, and net banking. Your payment details are processed securely and never stored on our servers.",
  },
];

async function main(): Promise<void> {
  await prisma.faq.deleteMany();
  await prisma.faq.createMany({ data: faqs });
  console.log(`Seeded ${faqs.length} FAQs.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
