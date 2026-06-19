import { env } from "./config/env.js";
import { createApp } from "./http/server.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
});
