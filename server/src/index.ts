import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { createApp } from "./http/server.js";

const app = createApp();

app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "Server listening");
});
