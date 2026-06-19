import express, { type Express } from "express";
import cors from "cors";

/**
 * Builds the Express app without binding a port, so it can be constructed in
 * tests and reused independently of process startup.
 */
export function createApp(): Express {
  const app = express();

  // TODO: restrict to CORS_ORIGIN once the frontend origin is known.
  app.use(cors());
  app.use(express.json());

  // Liveness probe for the host platform's health checks.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
