"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeMatchingJob = executeMatchingJob;
exports.connectKafka = connectKafka;
exports.disconnectKafka = disconnectKafka;
exports.getKafkaStatus = getKafkaStatus;
exports.publishMatchJob = publishMatchJob;
exports.resetKafkaMetrics = resetKafkaMetrics;
const kafkajs_1 = require("kafkajs");
const config_js_1 = require("./config.js");
const partitioner_js_1 = require("./partitioner.js");
const jobStore_js_1 = require("./jobStore.js");
const matcher_js_1 = require("../matcher.js");
// Metric counters
const metrics = {
    jobsQueued: 0,
    jobsProcessed: 0,
    jobsFailed: 0,
    activePartitions: config_js_1.KAFKA_CONFIG.numPartitions,
    avgLatencyMs: 0,
    totalThroughputPerSec: 0,
    partitionDistribution: {},
};
// Initialize partition distribution buckets
for (let i = 0; i < config_js_1.KAFKA_CONFIG.numPartitions; i++) {
    metrics.partitionDistribution[i] = 0;
}
let connectionMode = "DISCONNECTED";
let isConnected = false;
// Real Kafka instances
let kafka = null;
let producer = null;
let consumer = null;
let admin = null;
// Emulated queue for fallback/local execution
const emulatedQueue = [];
let emulatedWorkerTimer = null;
/**
 * Worker execution logic that runs ingredient composition matching for a job
 */
function executeMatchingJob(job, partition) {
    const startTime = performance.now();
    try {
        const config = job.config || {
            tolerance_pp: 3.0,
            max_extra_ingredients: 1,
            max_extra_percentage: 2.0,
            epsilon: 0.01,
        };
        const results = (0, matcher_js_1.matchCatalog)(job.reference_product, job.catalog, config);
        const endTime = performance.now();
        const duration = Math.round((endTime - startTime) * 100) / 100;
        const summary = {
            exact_matches: results.filter((r) => r.category === "EXACT_MATCH").length,
            close_matches: results.filter((r) => r.category === "CLOSE_MATCH").length,
            no_matches: results.filter((r) => r.category === "NO_MATCH").length,
        };
        const response = {
            reference_product: job.reference_product,
            total_candidates: job.catalog.length,
            summary,
            results,
        };
        const record = {
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
        jobStore_js_1.jobStore.update(job.jobId, record);
        return record;
    }
    catch (error) {
        metrics.jobsFailed++;
        const record = {
            jobId: job.jobId,
            userId: job.userId,
            status: "FAILED",
            createdAt: new Date(job.timestamp).toISOString(),
            completedAt: new Date().toISOString(),
            partition,
            error: error.message || "Unknown worker error",
        };
        jobStore_js_1.jobStore.update(job.jobId, record);
        return record;
    }
}
/**
 * Background loop for emulated worker group processing
 */
function startEmulatedWorker() {
    if (emulatedWorkerTimer)
        return;
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
async function connectKafka() {
    console.log(`[Kafka] Initializing connection to brokers: ${config_js_1.KAFKA_CONFIG.brokers.join(", ")}`);
    // Attempt real Kafka connection
    try {
        kafka = new kafkajs_1.Kafka({
            clientId: config_js_1.KAFKA_CONFIG.clientId,
            brokers: config_js_1.KAFKA_CONFIG.brokers,
            connectionTimeout: config_js_1.KAFKA_CONFIG.connectionTimeoutMs,
            logLevel: kafkajs_1.logLevel.NOTHING,
            retry: {
                retries: 0,
            },
        });
        admin = kafka.admin();
        await admin.connect();
        // Ensure topics exist with scalable partition counts
        const existingTopics = await admin.listTopics();
        const topicsToCreate = [];
        if (!existingTopics.includes(config_js_1.KAFKA_CONFIG.requestTopic)) {
            topicsToCreate.push({
                topic: config_js_1.KAFKA_CONFIG.requestTopic,
                numPartitions: config_js_1.KAFKA_CONFIG.numPartitions,
                replicationFactor: config_js_1.KAFKA_CONFIG.replicationFactor,
            });
        }
        if (!existingTopics.includes(config_js_1.KAFKA_CONFIG.resultTopic)) {
            topicsToCreate.push({
                topic: config_js_1.KAFKA_CONFIG.resultTopic,
                numPartitions: config_js_1.KAFKA_CONFIG.numPartitions,
                replicationFactor: config_js_1.KAFKA_CONFIG.replicationFactor,
            });
        }
        if (!existingTopics.includes(config_js_1.KAFKA_CONFIG.dlqTopic)) {
            topicsToCreate.push({
                topic: config_js_1.KAFKA_CONFIG.dlqTopic,
                numPartitions: Math.max(1, Math.floor(config_js_1.KAFKA_CONFIG.numPartitions / 4)),
                replicationFactor: config_js_1.KAFKA_CONFIG.replicationFactor,
            });
        }
        if (topicsToCreate.length > 0) {
            await admin.createTopics({ topics: topicsToCreate });
            console.log(`[Kafka] Created topics:`, topicsToCreate.map((t) => `${t.topic} (${t.numPartitions} partitions)`));
        }
        producer = kafka.producer({
            createPartitioner: kafkajs_1.Partitioners.DefaultPartitioner,
        });
        await producer.connect();
        consumer = kafka.consumer({ groupId: config_js_1.KAFKA_CONFIG.groupId });
        await consumer.connect();
        await consumer.subscribe({ topic: config_js_1.KAFKA_CONFIG.requestTopic, fromBeginning: false });
        // Start consuming messages in real mode
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                if (!message.value)
                    return;
                try {
                    const job = JSON.parse(message.value.toString());
                    executeMatchingJob(job, partition);
                }
                catch (err) {
                    console.error(`[Kafka Consumer] Error processing message on ${topic} p:${partition}`, err);
                }
            },
        });
        connectionMode = "REAL_BROKER";
        isConnected = true;
        console.log(`[Kafka] Connected to REAL broker cluster successfully.`);
    }
    catch (error) {
        if (config_js_1.KAFKA_CONFIG.useEmulatorIfBrokerUnavailable) {
            console.warn(`[Kafka] Could not reach real broker at ${config_js_1.KAFKA_CONFIG.brokers.join(", ")} (${error.message}). ` +
                `Switching to resilient Emulated Kafka Partition Engine (${config_js_1.KAFKA_CONFIG.numPartitions} partitions) to demonstrate 100k scale pipeline.`);
            connectionMode = "EMULATED";
            isConnected = true;
            startEmulatedWorker();
        }
        else {
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
async function disconnectKafka() {
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
function getKafkaStatus() {
    return {
        connected: isConnected,
        mode: connectionMode,
        brokers: config_js_1.KAFKA_CONFIG.brokers,
        clientId: config_js_1.KAFKA_CONFIG.clientId,
        groupId: config_js_1.KAFKA_CONFIG.groupId,
        topics: {
            requestTopic: config_js_1.KAFKA_CONFIG.requestTopic,
            resultTopic: config_js_1.KAFKA_CONFIG.resultTopic,
            dlqTopic: config_js_1.KAFKA_CONFIG.dlqTopic,
        },
        metrics: { ...metrics },
    };
}
/**
 * Publish match job to Kafka topic.
 * Uses consistent hashing on userId to guarantee per-user ordering
 * while spreading 100k users evenly across all partitions.
 */
async function publishMatchJob(job) {
    if (!isConnected) {
        await connectKafka();
    }
    const partition = (0, partitioner_js_1.getPartitionForUser)(job.userId, config_js_1.KAFKA_CONFIG.numPartitions);
    // Track metrics
    metrics.jobsQueued++;
    metrics.partitionDistribution[partition] = (metrics.partitionDistribution[partition] || 0) + 1;
    // Initial job status record
    jobStore_js_1.jobStore.set(job.jobId, {
        jobId: job.jobId,
        userId: job.userId,
        status: "QUEUED",
        createdAt: new Date(job.timestamp).toISOString(),
        partition,
    });
    if (connectionMode === "REAL_BROKER" && producer) {
        await producer.send({
            topic: config_js_1.KAFKA_CONFIG.requestTopic,
            compression: kafkajs_1.CompressionTypes.GZIP,
            messages: [
                {
                    key: job.userId,
                    value: JSON.stringify(job),
                    partition,
                },
            ],
        });
    }
    else {
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
function resetKafkaMetrics() {
    metrics.jobsQueued = 0;
    metrics.jobsProcessed = 0;
    metrics.jobsFailed = 0;
    metrics.avgLatencyMs = 0;
    metrics.totalThroughputPerSec = 0;
    for (let i = 0; i < config_js_1.KAFKA_CONFIG.numPartitions; i++) {
        metrics.partitionDistribution[i] = 0;
    }
}
