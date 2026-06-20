import express, { type Express } from "express";
import cors from "cors";
import { env } from "../config/env.js";
import { chatRouter } from "./routes/chat.routes.js";
import { errorHandler } from "./middleware/error-handler.js";

export function createApp(): Express {
  const app = express();

  // Restrict to the configured frontend origin when set; reflect any origin in
  // local development where CORS_ORIGIN is left empty.
  app.use(cors({ origin: env.CORS_ORIGIN || true }));
  // A chat message is capped at 4000 chars; this guards against oversized bodies.
  app.use(express.json({ limit: "100kb" }));

  // Liveness probe for the host platform's health checks.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/chat", chatRouter);

  // Must be registered after the routes.
  app.use(errorHandler);

  return app;
}
