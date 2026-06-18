import express, { type Express } from "express";
import cors from "cors";

/**
 * Builds and configures the Express application.
 *
 * Kept separate from the entrypoint (index.ts) so the app can be constructed
 * without binding a port — useful for tests and so later phases can register
 * routes/middleware here without touching process bootstrap concerns.
 */
export function createApp(): Express {
  const app = express();

  // CORS is permissive in Phase 0; it gets locked to CORS_ORIGIN in a later phase.
  app.use(cors());
  app.use(express.json());

  // Health check — used by Render's keep-warm pinger (see §7/§11).
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
