import { pinoHttp } from "pino-http";
import { logger } from "../../config/logger.js";

// One structured line per request. The log level is keyed off the response
// status (5xx -> error, 4xx -> warn, else info), health checks are skipped to
// keep logs readable, and auth headers are redacted.
export const requestLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/health" },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  redact: ["req.headers.authorization", "req.headers.cookie"],
});
