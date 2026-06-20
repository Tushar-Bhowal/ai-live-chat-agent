import { useCallback, useEffect, useRef, useState } from "react";
import { fetchHistory, sendMessage } from "@/lib/api";
import { getSessionId, setSessionId } from "@/lib/session";

export interface UiMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
}

export interface UseChat {
  messages: UiMessage[];
  sending: boolean;
  error: string | null;
  loadingHistory: boolean;
  send: (text: string) => void;
}

function newId(): string {
  return crypto.randomUUID();
}

// Owns the conversation: history, in-flight state, and sending.
export function useChat(): UseChat {
  const sessionIdRef = useRef<string | null>(getSessionId());
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only "loading" when there's a prior session whose history we need to fetch.
  const [loadingHistory, setLoadingHistory] = useState(
    sessionIdRef.current !== null,
  );

  // Restore the existing conversation on mount, if there is one.
  useEffect(() => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    let cancelled = false;
    fetchHistory(sessionId)
      .then((history) => {
        if (cancelled) return;
        setMessages(
          history.map((m) => ({ id: newId(), sender: m.sender, text: m.text })),
        );
      })
      .catch(() => {
        // Start fresh if history can't be loaded; not worth alarming the user.
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setError(null);
      setMessages((prev) => [
        ...prev,
        { id: newId(), sender: "user", text: trimmed },
      ]);
      setSending(true);

      void sendMessage(trimmed, sessionIdRef.current ?? undefined)
        .then((result) => {
          if (!sessionIdRef.current) {
            sessionIdRef.current = result.sessionId;
            setSessionId(result.sessionId);
          }
          setMessages((prev) => [
            ...prev,
            { id: newId(), sender: "ai", text: result.reply },
          ]);
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error
              ? err.message
              : "Something went wrong. Please resend your message.",
          );
        })
        .finally(() => setSending(false));
    },
    [sending],
  );

  return { messages, sending, error, loadingHistory, send };
}
