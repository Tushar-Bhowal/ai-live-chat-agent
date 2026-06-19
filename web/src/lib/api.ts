const BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000"
).replace(/\/$/, "");

export interface HistoryMessage {
  sender: "user" | "ai";
  text: string;
  createdAt: string;
}

export interface SendResult {
  reply: string;
  sessionId: string;
}

/** A failure surfaced to the user; its message is safe to display. */
export class ApiError extends Error {}

async function readError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // fall through to a generic message
  }
  return "Something went wrong. Please resend your message.";
}

export async function sendMessage(
  message: string,
  sessionId?: string,
): Promise<SendResult> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, sessionId }),
    });
  } catch {
    throw new ApiError(
      "Can't reach the server. Check your connection and try again.",
    );
  }
  if (!res.ok) {
    throw new ApiError(await readError(res));
  }
  return (await res.json()) as SendResult;
}

export async function fetchHistory(sessionId: string): Promise<HistoryMessage[]> {
  const res = await fetch(
    `${BASE_URL}/chat/${encodeURIComponent(sessionId)}/messages`,
  );
  if (!res.ok) {
    throw new ApiError("Could not load your previous messages.");
  }
  const data = (await res.json()) as { messages: HistoryMessage[] };
  return data.messages;
}
