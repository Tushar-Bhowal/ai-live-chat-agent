import { useEffect, useRef } from "react";
import Markdown, { type Components } from "react-markdown";
import { cn } from "@/lib/utils";
import { MessageLoading } from "@/components/MessageLoading";
import type { UiMessage } from "@/hooks/useChat";

// Render the agent's Markdown to fit inside a chat bubble. Raw HTML is not
// rendered by react-markdown, so this is safe to show untrusted model output.
const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-primary underline underline-offset-2"
    >
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="rounded bg-foreground/10 px-1 py-0.5 text-[0.85em]">
      {children}
    </code>
  ),
};

const GREETING =
  "Hi, I'm Mira 👋 I can help with orders, shipping, returns, and more. What can I do for you?";

interface MessageListProps {
  messages: UiMessage[];
  sending: boolean;
  error: string | null;
}

export function MessageList({ messages, sending, error }: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Scroll the list container itself (not scrollIntoView, which would also
  // scroll the page) so the newest message stays in view as the chat grows.
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, sending, error]);

  return (
    <div
      ref={containerRef}
      className="flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5"
    >
      <Bubble sender="ai" text={GREETING} />

      {messages.map((message) => (
        <Bubble key={message.id} sender={message.sender} text={message.text} />
      ))}

      {sending && <TypingIndicator />}

      {error && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-destructive/10 px-4 py-2.5 text-sm leading-relaxed text-destructive sm:max-w-[72%]">
            {error}
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ sender, text }: { sender: "user" | "ai"; text: string }) {
  const isUser = sender === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed wrap-break-word duration-200 animate-in fade-in slide-in-from-bottom-2 sm:max-w-[72%]",
          isUser
            ? "rounded-br-md bg-primary whitespace-pre-wrap text-primary-foreground"
            : "rounded-bl-md bg-secondary text-secondary-foreground",
        )}
      >
        {isUser ? (
          text
        ) : (
          <Markdown components={markdownComponents}>{text}</Markdown>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center rounded-2xl rounded-bl-md bg-secondary px-3 py-2">
        <MessageLoading />
        <span className="sr-only">Mira is typing</span>
      </div>
    </div>
  );
}
