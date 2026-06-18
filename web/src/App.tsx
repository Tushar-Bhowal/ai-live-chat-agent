import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Phase 0 themed "hello" page.
 *
 * A placeholder that proves the Tailwind v4 + shadcn theme (§8.1) is wired up —
 * warm amber accent, Inter font, brand surfaces, AI/user bubbles, and a working
 * light/dark toggle. Phase 5 replaces it with the real ChatWidget.
 */
function App() {
  // Light by default (§8.1); the toggle adds/removes the `.dark` class on <html>,
  // which flips every shadcn CSS-variable token.
  const [dark, setDark] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark)
  }, [dark])

  return (
    <main className="flex min-h-svh items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-sm">
        {/* Header — agent name + online-status dot (signature touch, §8.1). */}
        <header className="flex items-center gap-3 border-b border-border px-5 py-4">
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
            onClick={() => setDark((d) => !d)}
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        <div className="space-y-4 px-5 py-6">
          {/* AI bubble — left-aligned, soft surface, ink text (§8.1). */}
          <div className="max-w-[72%] rounded-2xl rounded-bl-md bg-secondary px-4 py-2.5 text-sm leading-relaxed text-secondary-foreground">
            Hi! 👋 The scaffold is themed and ready. The chat experience lands in
            Phase 5.
          </div>
          {/* User bubble — right-aligned, solid accent, white text (§8.1). */}
          <div className="ml-auto max-w-[72%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
            Looks good — amber accent and Inter font are live.
          </div>
        </div>

        <footer className="flex items-center gap-2 border-t border-border px-5 py-4">
          <div className="flex-1 rounded-[10px] border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
            Type a message…
          </div>
          <Button>Send</Button>
        </footer>
      </div>
    </main>
  )
}

export default App
