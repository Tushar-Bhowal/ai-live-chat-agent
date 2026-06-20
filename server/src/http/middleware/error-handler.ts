import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { InvalidMessageError } from "../../domain/agent/agent.service.js";
import { LLMError } from "../../domain/llm/index.js";

// Registered last. Turns any thrown error (Express 5 forwards async rejections
// here too) into a clean JSON response instead of a crash. Logs through req.log
// so each line is correlated with its request id.
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "Invalid request" });
    return;
  }

  if (err instanceof InvalidMessageError) {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err instanceof LLMError) {
    // Log the precise cause for operators; show one friendly line to the user.
    req.log.error({ kind: err.kind, err: err.cause }, "LLM request failed");
    res.status(502).json({
      error: "The assistant is unavailable right now. Please try again.",
    });
    return;
  }

  // Malformed or oversized JSON bodies surface as body-parser errors.
  if (typeof err === "object" && err !== null && "type" in err) {
    const parserError = err as { type?: string };
    if (parserError.type === "entity.parse.failed") {
      res.status(400).json({ error: "Invalid JSON in request body." });
      return;
    }
    if (parserError.type === "entity.too.large") {
      res.status(413).json({ error: "Request body is too large." });
      return;
    }
  }

  req.log.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
