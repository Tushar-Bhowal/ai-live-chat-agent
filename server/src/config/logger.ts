import pino from "pino";
import { env } from "./env.js";

const isProd = env.NODE_ENV === "production";

// JSON logs in production (so a log aggregator can query them); human-readable,
// colorized logs in development.
export const logger = pino({
  level: isProd ? "info" : "debug",
  ...(isProd
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss" },
        },
      }),
});
