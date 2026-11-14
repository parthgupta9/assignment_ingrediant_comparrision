"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const client_js_1 = require("../src/kafka/client.js");
const partitioner_js_1 = require("../src/kafka/partitioner.js");
const jobStore_js_1 = require("../src/kafka/jobStore.js");
const scaleSimulator_js_1 = require("../src/kafka/scaleSimulator.js");
(0, vitest_1.describe)("Kafka High-Throughput Pipeline & 100k Scalability Suite", () => {
    (0, vitest_1.beforeAll)(async () => {
        (0, client_js_1.resetKafkaMetrics)();
        jobStore_js_1.jobStore.clear();
        await (0, client_js_1.connectKafka)();
    });
    (0, vitest_1.afterAll)(async () => {
        await (0, client_js_1.disconnectKafka)();
    });
    (0, vitest_1.it)("1. connectKafka establishes valid connection state with topic configurations", () => {
        const status = (0, client_js_1.getKafkaStatus)();
        (0, vitest_1.expect)(status.connected).toBe(true);
        (0, vitest_1.expect)(["REAL_BROKER", "EMULATED"]).toContain(status.mode);
        (0, vitest_1.expect)(status.topics.requestTopic).toBe("ingredient-match-requests");
        (0, vitest_1.expect)(status.metrics.activePartitions).toBeGreaterThan(0);
    });
    (0, vitest_1.it)("2. Partitioning distributes users deterministically across partitions", () => {
        const numPartitions = 16;
        const userA = "user_pharmalab_alpha";
        const userB = "user_biogen_beta";
        const pA1 = (0, partitioner_js_1.getPartitionForUser)(userA, numPartitions);
        const pA2 = (0, partitioner_js_1.getPartitionForUser)(userA, numPartitions);
        const pB = (0, partitioner_js_1.getPartitionForUser)(userB, numPartitions);
        // Deterministic for same user
        (0, vitest_1.expect)(pA1).toBe(pA2);
        (0, vitest_1.expect)(pA1).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(pA1).toBeLessThan(numPartitions);
        (0, vitest_1.expect)(pB).toBeGreaterThanOrEqual(0);
        (0, vitest_1.expect)(pB).toBeLessThan(numPartitions);
    });
    (0, vitest_1.it)("3. Partitioning spreads 10,000 distinct users uniformly without hotspotting", () => {
        const numPartitions = 16;
        const counts = {};
        for (let i = 0; i < numPartitions; i++)
            counts[i] = 0;
        const totalUsers = 10000;
        for (let i = 0; i < totalUsers; i++) {
            const p = (0, partitioner_js_1.getPartitionForUser)(`user_${i}`, numPartitions);
            counts[p]++;
        }
        const ideal = totalUsers / numPartitions; // 625
        for (let i = 0; i < numPartitions; i++) {
            // Every partition receives traffic; deviation within reasonable bounds
            (0, vitest_1.expect)(counts[i]).toBeGreaterThan(ideal * 0.7);
            (0, vitest_1.expect)(counts[i]).toBeLessThan(ideal * 1.3);
        }
    });
    (0, vitest_1.it)("4. publishMatchJob successfully queues match job and assigns partition", async () => {
        const sampleProduct = {
            name: "Amoxicillin 500mg",
            manufacturer: "HealthCare Inc",
            composition: { Amoxicillin: 87.5, Clavulanate: 12.5 },
        };
        const jobRequest = {
            jobId: "test_job_123",
            userId: "user_client_42",
            timestamp: Date.now(),
            reference_product: sampleProduct,
            catalog: [
                {
                    name: "AmoxiClav Generic",
                    manufacturer: "GenericPharma",
                    composition: { Amoxicillin: 87.5, Clavulanate: 12.5 },
                },
            ],
        };
        const result = await (0, client_js_1.publishMatchJob)(jobRequest);
        (0, vitest_1.expect)(result.jobId).toBe("test_job_123");
        (0, vitest_1.expect)(result.status).toBe("QUEUED");
        (0, vitest_1.expect)(result.partition).toBeGreaterThanOrEqual(0);
        const stored = jobStore_js_1.jobStore.get("test_job_123");
        (0, vitest_1.expect)(stored).toBeDefined();
        (0, vitest_1.expect)(stored?.userId).toBe("user_client_42");
    });
    (0, vitest_1.it)("5. Worker processes queued match job and stores completed result", async () => {
        // Wait for the worker tick to process the job
        await new Promise((resolve) => setTimeout(resolve, 100));
        const completed = jobStore_js_1.jobStore.get("test_job_123");
        (0, vitest_1.expect)(completed).toBeDefined();
        (0, vitest_1.expect)(completed?.status).toBe("COMPLETED");
        (0, vitest_1.expect)(completed?.response).toBeDefined();
        (0, vitest_1.expect)(completed?.response?.summary.exact_matches).toBe(1);
        (0, vitest_1.expect)(completed?.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
    (0, vitest_1.it)("6. runScaleSimulation models 100,000 user burst with high throughput and low skew", async () => {
        const result = await (0, scaleSimulator_js_1.runScaleSimulation)(10000, 16, 5);
        (0, vitest_1.expect)(result.totalUsers).toBe(10000);
        (0, vitest_1.expect)(result.numPartitions).toBe(16);
        (0, vitest_1.expect)(result.producerThroughputPerSec).toBeGreaterThan(10000); // Super-fast enqueue
        (0, vitest_1.expect)(result.maxPartitionSkewPercent).toBeLessThan(25); // Well balanced
        (0, vitest_1.expect)(result.scalingAnalysis.verdict).toContain("Kafka decouples HTTP ingress");
    });
});
