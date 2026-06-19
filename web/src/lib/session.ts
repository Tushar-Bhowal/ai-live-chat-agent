const STORAGE_KEY = "chat_session_id";

/** The widget tracks a single ongoing conversation, keyed in localStorage. */
export function getSessionId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setSessionId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Ignore storage failures (e.g. private mode); chat still works in-memory.
  }
}
