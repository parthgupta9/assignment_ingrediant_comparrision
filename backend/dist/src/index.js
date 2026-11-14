"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const types_js_1 = require("./types.js");
const matcher_js_1 = require("./matcher.js");
const client_js_1 = require("./kafka/client.js");
const jobStore_js_1 = require("./kafka/jobStore.js");
const scaleSimulator_js_1 = require("./kafka/scaleSimulator.js");
exports.app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
exports.app.use((0, cors_1.default)());
exports.app.use(express_1.default.json({ limit: "50mb" }));
// Health Check
exports.app.get("/api/health", (_req, res) => {
    res.json({
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "ingredient-matcher-backend",
    });
});
// Load sample dataset
exports.app.get("/api/sample", (_req, res) => {
    try {
        const samplePath = path_1.default.join(__dirname, "sample_products.json");
        if (fs_1.default.existsSync(samplePath)) {
            const rawData = fs_1.default.readFileSync(samplePath, "utf-8");
            return res.json(JSON.parse(rawData));
        }
        return res.status(404).json({ error: "Sample data file not found" });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
});
// Synchronous Match endpoint (Direct evaluation)
exports.app.post("/api/match", (req, res) => {
    try {
        const parseResult = types_js_1.MatchRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: "Validation error in request payload",
                details: parseResult.error.flatten(),
            });
        }
        const { reference_product, catalog, config } = parseResult.data;
        const results = (0, matcher_js_1.matchCatalog)(reference_product, catalog, config);
        const summary = {
            exact_matches: results.filter((r) => r.category === "EXACT_MATCH").length,
            close_matches: results.filter((r) => r.category === "CLOSE_MATCH").length,
            no_matches: results.filter((r) => r.category === "NO_MATCH").length,
        };
        const response = {
            reference_product,
            total_candidates: catalog.length,
            summary,
            results,
        };
        return res.json(response);
    }
    catch (error) {
        return res.status(500).json({
            error: "Internal server error during matching process",
            message: error.message,
        });
    }
});
// -------------------------------------------------------------
// KAFKA HIGH-THROUGHPUT PIPELINE ENDPOINTS (SCALING TO 100K USERS)
// -------------------------------------------------------------
// Kafka Cluster & Pipeline Status
exports.app.get("/api/kafka/status", (_req, res) => {
    const status = (0, client_js_1.getKafkaStatus)();
    return res.json(status);
});
// Asynchronous Match Endpoint (Non-blocking ingestion via Kafka)
exports.app.post("/api/match/async", async (req, res) => {
    try {
        const parseResult = types_js_1.MatchRequestSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: "Validation error in request payload",
                details: parseResult.error.flatten(),
            });
        }
        const userId = req.headers["x-user-id"] || req.body.userId || `user_${crypto_1.default.randomBytes(4).toString("hex")}`;
        const jobId = `job_${Date.now()}_${crypto_1.default.randomBytes(4).toString("hex")}`;
        const jobRequest = {
            jobId,
            userId,
            timestamp: Date.now(),
            reference_product: parseResult.data.reference_product,
            catalog: parseResult.data.catalog,
            config: parseResult.data.config,
        };
        const result = await (0, client_js_1.publishMatchJob)(jobRequest);
        return res.status(202).json({
            message: "Match request successfully queued into Kafka pipeline",
            jobId: result.jobId,
            userId,
            status: result.status,
            assignedPartition: result.partition,
            kafkaMode: result.mode,
            checkStatusUrl: `/api/match/jobs/${result.jobId}`,
        });
    }
    catch (error) {
        return res.status(500).json({
            error: "Failed to queue match request to Kafka",
            message: error.message,
        });
    }
});
// Retrieve status / result of an async match job
exports.app.get("/api/match/jobs/:id", (req, res) => {
    const jobId = req.params.id;
    const job = jobStore_js_1.jobStore.get(jobId);
    if (!job) {
        return res.status(404).json({
            error: "Job not found or expired from store",
            jobId,
        });
    }
    return res.json(job);
});
// Run 100k Users Scalability Simulation
exports.app.post("/api/kafka/simulate-scale", async (req, res) => {
    try {
        const userCount = Math.min(Math.max(parseInt(req.body.userCount || "100000", 10), 100), 100000);
        const partitions = parseInt(req.body.partitions || "16", 10);
        const catalogSize = parseInt(req.body.catalogSize || "10", 10);
        const simulation = await (0, scaleSimulator_js_1.runScaleSimulation)(userCount, partitions, catalogSize);
        return res.json(simulation);
    }
    catch (error) {
        return res.status(500).json({
            error: "Simulation execution failed",
            message: error.message,
        });
    }
});
// Only listen if executed directly
if (process.env.NODE_ENV !== "test") {
    exports.app.listen(PORT, async () => {
        console.log(`🚀 Ingredient Matcher Backend running on http://localhost:${PORT}`);
        console.log(`Endpoints:`);
        console.log(`  - GET  /api/health`);
        console.log(`  - GET  /api/sample`);
        console.log(`  - POST /api/match               (Synchronous evaluate)`);
        console.log(`  - GET  /api/kafka/status         (Kafka health & metrics)`);
        console.log(`  - POST /api/match/async          (Kafka non-blocking queue)`);
        console.log(`  - GET  /api/match/jobs/:id       (Job result retrieval)`);
        console.log(`  - POST /api/kafka/simulate-scale (100k users scale simulation)`);
        // Connect Kafka on boot
        try {
            await (0, client_js_1.connectKafka)();
        }
        catch (err) {
            console.error("[Kafka] Boot connection error:", err);
        }
    });
}
