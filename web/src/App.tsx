import { ChatWidget } from "@/components/ChatWidget"
import { NotFound } from "@/components/NotFound"

function App() {
  // Single-page app: the widget lives at "/", anything else is a 404.
  if (window.location.pathname !== "/") {
    return <NotFound />
  }

  return (
    <main className="flex min-h-svh items-center justify-center sm:p-4">
      <ChatWidget />
    </main>
  )
}

export default App
