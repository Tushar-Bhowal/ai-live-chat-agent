import { useRef, useState, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

const MAX_HEIGHT_PX = 120;

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    resetHeight();
  }

  function resetHeight() {
    const el = textareaRef.current;
    if (el) el.style.height = "auto";
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter inserts a newline.
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-border px-3 py-3 sm:px-4">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          const el = event.target;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
        }}
        onKeyDown={handleKeyDown}
        rows={1}
        placeholder="Type your message…"
        aria-label="Message"
        className={cn(
          "max-h-[120px] flex-1 resize-none rounded-[10px] border border-input bg-background px-3 py-2 text-sm leading-relaxed",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        )}
      />
      <Button
        type="button"
        size="icon"
        onClick={submit}
        disabled={disabled || value.trim().length === 0}
        aria-label="Send"
      >
        <SendHorizontal className="size-4" />
      </Button>
    </div>
  );
}
