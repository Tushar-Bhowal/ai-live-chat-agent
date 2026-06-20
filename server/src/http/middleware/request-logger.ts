import { pinoHttp } from "pino-http";
import { logger } from "../../config/logger.js";

// One concise line per request. The level is keyed off the response status
// (5xx -> error, 4xx -> warn, else info), and health checks are skipped to keep
// logs readable. Serializers keep only the essentials (method, url, status);
// pino-http adds the response time automatically.
export const requestLogger = pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === "/health" },
  customLogLevel(_req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
  serializers: {
    req: (req) => ({ method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});
