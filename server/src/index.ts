import { createApp } from "./http/server.js";

// Phase 0: minimal bootstrap. Later phases will validate env (config/env.ts)
// and connect the DB here before listening.
const PORT = Number(process.env.PORT ?? 4000);

const app = createApp();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
