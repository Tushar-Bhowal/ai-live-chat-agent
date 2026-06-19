import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { useChat } from "@/hooks/useChat";

export function ChatWidget() {
  const { messages, sending, error, send } = useChat();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <div className="flex h-[100svh] w-full flex-col overflow-hidden bg-card shadow-sm sm:h-[min(640px,90svh)] sm:max-w-md sm:rounded-2xl sm:border sm:border-border">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3.5 sm:px-5">
        <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
          AI
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">
            Support Assistant
          </span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            Online
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
          onClick={() => setDark((value) => !value)}
        >
          {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </header>

      <MessageList messages={messages} sending={sending} error={error} />

      <MessageInput onSend={send} disabled={sending} />
    </div>
  );
}
