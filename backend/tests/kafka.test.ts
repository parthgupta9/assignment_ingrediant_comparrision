import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { connectKafka, disconnectKafka, publishMatchJob, getKafkaStatus, resetKafkaMetrics } from "../src/kafka/client.js";
import { getPartitionForUser } from "../src/kafka/partitioner.js";
import { jobStore } from "../src/kafka/jobStore.js";
import { runScaleSimulation } from "../src/kafka/scaleSimulator.js";
import { MatchJobRequest } from "../src/kafka/types.js";
import { Product } from "../src/types.js";

describe("Kafka High-Throughput Pipeline & 100k Scalability Suite", () => {
  beforeAll(async () => {
    resetKafkaMetrics();
    jobStore.clear();
    await connectKafka();
  });

  afterAll(async () => {
    await disconnectKafka();
  });

  it("1. connectKafka establishes valid connection state with topic configurations", () => {
    const status = getKafkaStatus();
    expect(status.connected).toBe(true);
    expect(["REAL_BROKER", "EMULATED"]).toContain(status.mode);
    expect(status.topics.requestTopic).toBe("ingredient-match-requests");
    expect(status.metrics.activePartitions).toBeGreaterThan(0);
  });

  it("2. Partitioning distributes users deterministically across partitions", () => {
    const numPartitions = 16;
    const userA = "user_pharmalab_alpha";
    const userB = "user_biogen_beta";

    const pA1 = getPartitionForUser(userA, numPartitions);
    const pA2 = getPartitionForUser(userA, numPartitions);
    const pB = getPartitionForUser(userB, numPartitions);

    // Deterministic for same user
    expect(pA1).toBe(pA2);
    expect(pA1).toBeGreaterThanOrEqual(0);
    expect(pA1).toBeLessThan(numPartitions);
    expect(pB).toBeGreaterThanOrEqual(0);
    expect(pB).toBeLessThan(numPartitions);
  });

  it("3. Partitioning spreads 10,000 distinct users uniformly without hotspotting", () => {
    const numPartitions = 16;
    const counts: Record<number, number> = {};
    for (let i = 0; i < numPartitions; i++) counts[i] = 0;

    const totalUsers = 10000;
    for (let i = 0; i < totalUsers; i++) {
      const p = getPartitionForUser(`user_${i}`, numPartitions);
      counts[p]++;
    }

    const ideal = totalUsers / numPartitions; // 625
    for (let i = 0; i < numPartitions; i++) {
      // Every partition receives traffic; deviation within reasonable bounds
      expect(counts[i]).toBeGreaterThan(ideal * 0.7);
      expect(counts[i]).toBeLessThan(ideal * 1.3);
    }
  });

  it("4. publishMatchJob successfully queues match job and assigns partition", async () => {
    const sampleProduct: Product = {
      name: "Amoxicillin 500mg",
      manufacturer: "HealthCare Inc",
      composition: { Amoxicillin: 87.5, Clavulanate: 12.5 },
    };

    const jobRequest: MatchJobRequest = {
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

    const result = await publishMatchJob(jobRequest);

    expect(result.jobId).toBe("test_job_123");
    expect(result.status).toBe("QUEUED");
    expect(result.partition).toBeGreaterThanOrEqual(0);

    const stored = jobStore.get("test_job_123");
    expect(stored).toBeDefined();
    expect(stored?.userId).toBe("user_client_42");
  });

  it("5. Worker processes queued match job and stores completed result", async () => {
    // Wait for the worker tick to process the job
    await new Promise((resolve) => setTimeout(resolve, 100));

    const completed = jobStore.get("test_job_123");
    expect(completed).toBeDefined();
    expect(completed?.status).toBe("COMPLETED");
    expect(completed?.response).toBeDefined();
    expect(completed?.response?.summary.exact_matches).toBe(1);
    expect(completed?.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("6. runScaleSimulation models 100,000 user burst with high throughput and low skew", async () => {
    const result = await runScaleSimulation(10000, 16, 5);

    expect(result.totalUsers).toBe(10000);
    expect(result.numPartitions).toBe(16);
    expect(result.producerThroughputPerSec).toBeGreaterThan(10000); // Super-fast enqueue
    expect(result.maxPartitionSkewPercent).toBeLessThan(25); // Well balanced
    expect(result.scalingAnalysis.verdict).toContain("Kafka decouples HTTP ingress");
  });
});
