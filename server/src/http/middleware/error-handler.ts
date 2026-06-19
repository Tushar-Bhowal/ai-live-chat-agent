import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { InvalidMessageError } from "../../domain/agent/agent.service.js";
import { LLMError } from "../../domain/llm/index.js";

/**
 * Central error handler. Registered last so any error thrown from a route —
 * including rejected promises, which Express 5 forwards automatically — becomes
 * a clean JSON response instead of a crash or stack trace.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
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
    console.error(`LLM error [${err.kind}]:`, err.cause ?? err.message);
    res.status(502).json({
      error: "The assistant is unavailable right now. Please try again.",
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
};
