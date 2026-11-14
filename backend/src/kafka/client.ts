import { Kafka, Producer, Consumer, Admin, Partitioners, CompressionTypes, logLevel } from "kafkajs";
import { KAFKA_CONFIG } from "./config.js";
import {
  MatchJobRequest,
  MatchJobRecord,
  KafkaConnectionState,
  KafkaMetrics,
} from "./types.js";
import { getPartitionForUser } from "./partitioner.js";
import { jobStore } from "./jobStore.js";
import { matchCatalog } from "../matcher.js";
import { MatchResponse } from "../types.js";

// Metric counters
const metrics: KafkaMetrics = {
  jobsQueued: 0,
  jobsProcessed: 0,
  jobsFailed: 0,
  activePartitions: KAFKA_CONFIG.numPartitions,
  avgLatencyMs: 0,
  totalThroughputPerSec: 0,
  partitionDistribution: {},
};

// Initialize partition distribution buckets
for (let i = 0; i < KAFKA_CONFIG.numPartitions; i++) {
  metrics.partitionDistribution[i] = 0;
}

let connectionMode: "REAL_BROKER" | "EMULATED" | "DISCONNECTED" = "DISCONNECTED";
let isConnected = false;

// Real Kafka instances
let kafka: Kafka | null = null;
let producer: Producer | null = null;
let consumer: Consumer | null = null;
let admin: Admin | null = null;

// Emulated queue for fallback/local execution
const emulatedQueue: Array<{ job: MatchJobRequest; partition: number }> = [];
let emulatedWorkerTimer: NodeJS.Timeout | null = null;

/**
 * Worker execution logic that runs ingredient composition matching for a job
 */
export function executeMatchingJob(job: MatchJobRequest, partition: number): MatchJobRecord {
  const startTime = performance.now();
  try {
    const config = job.config || {
      tolerance_pp: 3.0,
      max_extra_ingredients: 1,
      max_extra_percentage: 2.0,
      epsilon: 0.01,
    };
    const results = matchCatalog(job.reference_product, job.catalog, config);
    const endTime = performance.now();
    const duration = Math.round((endTime - startTime) * 100) / 100;

    const summary = {
      exact_matches: results.filter((r) => r.category === "EXACT_MATCH").length,
      close_matches: results.filter((r) => r.category === "CLOSE_MATCH").length,
      no_matches: results.filter((r) => r.category === "NO_MATCH").length,
    };

    const response: MatchResponse = {
      reference_product: job.reference_product,
      total_candidates: job.catalog.length,
      summary,
      results,
    };

    const record: MatchJobRecord = {
      jobId: job.jobId,
      userId: job.userId,
      status: "COMPLETED",
      createdAt: new Date(job.timestamp).toISOString(),
      completedAt: new Date().toISOString(),
      processingTimeMs: duration,
      partition,
      response,
    };

    // Update global metrics
    metrics.jobsProcessed++;
    metrics.avgLatencyMs =
      Math.round(((metrics.avgLatencyMs * (metrics.jobsProcessed - 1) + duration) / metrics.jobsProcessed) * 100) / 100;

    jobStore.update(job.jobId, record);
    return record;
  } catch (error: any) {
    metrics.jobsFailed++;
    const record: MatchJobRecord = {
      jobId: job.jobId,
      userId: job.userId,
      status: "FAILED",
      createdAt: new Date(job.timestamp).toISOString(),
      completedAt: new Date().toISOString(),
      partition,
      error: error.message || "Unknown worker error",
    };
    jobStore.update(job.jobId, record);
    return record;
  }
}

/**
 * Background loop for emulated worker group processing
 */
function startEmulatedWorker(): void {
  if (emulatedWorkerTimer) return;

  emulatedWorkerTimer = setInterval(() => {
    // Process micro-batches of up to 50 items per tick
    const batch = emulatedQueue.splice(0, 50);
    for (const item of batch) {
      executeMatchingJob(item.job, item.partition);
    }
  }, 20);
}

/**
 * Connect function: Initializes Kafka producer, consumer, and topic partitions.
 * If real broker is not active, gracefully starts high-throughput emulated mode.
 */
export async function connectKafka(): Promise<KafkaConnectionState> {
  console.log(`[Kafka] Initializing connection to brokers: ${KAFKA_CONFIG.brokers.join(", ")}`);

  // Attempt real Kafka connection
  try {
    kafka = new Kafka({
      clientId: KAFKA_CONFIG.clientId,
      brokers: KAFKA_CONFIG.brokers,
      connectionTimeout: KAFKA_CONFIG.connectionTimeoutMs,
      logLevel: logLevel.NOTHING,
      retry: {
        retries: 0,
      },
    });

    admin = kafka.admin();
    await admin.connect();

    // Ensure topics exist with scalable partition counts
    const existingTopics = await admin.listTopics();
    const topicsToCreate = [];

    if (!existingTopics.includes(KAFKA_CONFIG.requestTopic)) {
      topicsToCreate.push({
        topic: KAFKA_CONFIG.requestTopic,
        numPartitions: KAFKA_CONFIG.numPartitions,
        replicationFactor: KAFKA_CONFIG.replicationFactor,
      });
    }
    if (!existingTopics.includes(KAFKA_CONFIG.resultTopic)) {
      topicsToCreate.push({
        topic: KAFKA_CONFIG.resultTopic,
        numPartitions: KAFKA_CONFIG.numPartitions,
        replicationFactor: KAFKA_CONFIG.replicationFactor,
      });
    }
    if (!existingTopics.includes(KAFKA_CONFIG.dlqTopic)) {
      topicsToCreate.push({
        topic: KAFKA_CONFIG.dlqTopic,
        numPartitions: Math.max(1, Math.floor(KAFKA_CONFIG.numPartitions / 4)),
        replicationFactor: KAFKA_CONFIG.replicationFactor,
      });
    }

    if (topicsToCreate.length > 0) {
      await admin.createTopics({ topics: topicsToCreate });
      console.log(`[Kafka] Created topics:`, topicsToCreate.map((t) => `${t.topic} (${t.numPartitions} partitions)`));
    }

    producer = kafka.producer({
      createPartitioner: Partitioners.DefaultPartitioner,
    });
    await producer.connect();

    consumer = kafka.consumer({ groupId: KAFKA_CONFIG.groupId });
    await consumer.connect();
    await consumer.subscribe({ topic: KAFKA_CONFIG.requestTopic, fromBeginning: false });

    // Start consuming messages in real mode
    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) return;
        try {
          const job: MatchJobRequest = JSON.parse(message.value.toString());
          executeMatchingJob(job, partition);
        } catch (err) {
          console.error(`[Kafka Consumer] Error processing message on ${topic} p:${partition}`, err);
        }
      },
    });

    connectionMode = "REAL_BROKER";
    isConnected = true;
    console.log(`[Kafka] Connected to REAL broker cluster successfully.`);
  } catch (error: any) {
    if (KAFKA_CONFIG.useEmulatorIfBrokerUnavailable) {
      console.warn(
        `[Kafka] Could not reach real broker at ${KAFKA_CONFIG.brokers.join(", ")} (${error.message}). ` +
        `Switching to resilient Emulated Kafka Partition Engine (${KAFKA_CONFIG.numPartitions} partitions) to demonstrate 100k scale pipeline.`
      );
      connectionMode = "EMULATED";
      isConnected = true;
      startEmulatedWorker();
    } else {
      connectionMode = "DISCONNECTED";
      isConnected = false;
      throw error;
    }
  }

  return getKafkaStatus();
}

/**
 * Disconnect function to cleanly tear down Kafka connections
 */
export async function disconnectKafka(): Promise<void> {
  if (emulatedWorkerTimer) {
    clearInterval(emulatedWorkerTimer);
    emulatedWorkerTimer = null;
  }

  if (consumer) {
    await consumer.disconnect();
    consumer = null;
  }
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
  if (admin) {
    await admin.disconnect();
    admin = null;
  }

  isConnected = false;
  connectionMode = "DISCONNECTED";
  console.log(`[Kafka] Disconnected successfully.`);
}

/**
 * Returns current health status, active mode, and scaling metrics
 */
export function getKafkaStatus(): KafkaConnectionState {
  return {
    connected: isConnected,
    mode: connectionMode,
    brokers: KAFKA_CONFIG.brokers,
    clientId: KAFKA_CONFIG.clientId,
    groupId: KAFKA_CONFIG.groupId,
    topics: {
      requestTopic: KAFKA_CONFIG.requestTopic,
      resultTopic: KAFKA_CONFIG.resultTopic,
      dlqTopic: KAFKA_CONFIG.dlqTopic,
    },
    metrics: { ...metrics },
  };
}

/**
 * Publish match job to Kafka topic.
 * Uses consistent hashing on userId to guarantee per-user ordering
 * while spreading 100k users evenly across all partitions.
 */
export async function publishMatchJob(job: MatchJobRequest): Promise<{
  jobId: string;
  partition: number;
  status: "QUEUED";
  mode: string;
}> {
  if (!isConnected) {
    await connectKafka();
  }

  const partition = getPartitionForUser(job.userId, KAFKA_CONFIG.numPartitions);

  // Track metrics
  metrics.jobsQueued++;
  metrics.partitionDistribution[partition] = (metrics.partitionDistribution[partition] || 0) + 1;

  // Initial job status record
  jobStore.set(job.jobId, {
    jobId: job.jobId,
    userId: job.userId,
    status: "QUEUED",
    createdAt: new Date(job.timestamp).toISOString(),
    partition,
  });

  if (connectionMode === "REAL_BROKER" && producer) {
    await producer.send({
      topic: KAFKA_CONFIG.requestTopic,
      compression: CompressionTypes.GZIP,
      messages: [
        {
          key: job.userId,
          value: JSON.stringify(job),
          partition,
        },
      ],
    });
  } else {
    // Enqueue in emulated partitioned queue
    emulatedQueue.push({ job, partition });
  }

  return {
    jobId: job.jobId,
    partition,
    status: "QUEUED",
    mode: connectionMode,
  };
}

/**
 * Resets metrics for testing and benchmarking
 */
export function resetKafkaMetrics(): void {
  metrics.jobsQueued = 0;
  metrics.jobsProcessed = 0;
  metrics.jobsFailed = 0;
  metrics.avgLatencyMs = 0;
  metrics.totalThroughputPerSec = 0;
  for (let i = 0; i < KAFKA_CONFIG.numPartitions; i++) {
    metrics.partitionDistribution[i] = 0;
  }
}
