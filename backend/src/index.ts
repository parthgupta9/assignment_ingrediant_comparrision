import express, { Request, Response } from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { MatchRequestSchema, MatchResponse } from "./types.js";
import { matchCatalog } from "./matcher.js";

export const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: "50mb" }));

// Health Check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "ingredient-matcher-backend",
  });
});

// Load sample dataset
app.get("/api/sample", (_req: Request, res: Response) => {
  try {
    const samplePath = path.join(__dirname, "sample_products.json");
    if (fs.existsSync(samplePath)) {
      const rawData = fs.readFileSync(samplePath, "utf-8");
      return res.json(JSON.parse(rawData));
    }
    return res.status(404).json({ error: "Sample data file not found" });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

// Match endpoint
app.post("/api/match", (req: Request, res: Response) => {
  try {
    const parseResult = MatchRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: "Validation error in request payload",
        details: parseResult.error.flatten(),
      });
    }

    const { reference_product, catalog, config } = parseResult.data;

    const results = matchCatalog(reference_product, catalog, config);

    const summary = {
      exact_matches: results.filter((r) => r.category === "EXACT_MATCH").length,
      close_matches: results.filter((r) => r.category === "CLOSE_MATCH").length,
      no_matches: results.filter((r) => r.category === "NO_MATCH").length,
    };

    const response: MatchResponse = {
      reference_product,
      total_candidates: catalog.length,
      summary,
      results,
    };

    return res.json(response);
  } catch (error: any) {
    return res.status(500).json({
      error: "Internal server error during matching process",
      message: error.message,
    });
  }
});

// Only listen if executed directly
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 Ingredient Matcher Backend running on http://localhost:${PORT}`);
    console.log(`Endpoints:`);
    console.log(`  - GET  /api/health`);
    console.log(`  - GET  /api/sample`);
    console.log(`  - POST /api/match`);
  });
}
