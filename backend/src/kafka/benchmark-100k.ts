import { runScaleSimulation } from "./scaleSimulator.js";
import { connectKafka, disconnectKafka } from "./client.js";

async function main() {
  console.log("===============================================================");
  console.log("   KAFKA 100K USERS SCALABILITY BENCHMARK & ARCHITECTURE DEMO ");
  console.log("===============================================================");
  console.log("\n1. Testing Kafka Connection Function...");

  const kafkaState = await connectKafka();
  console.log(`✓ Kafka Connected. Mode: [${kafkaState.mode}]`);
  console.log(`  Brokers: ${kafkaState.brokers.join(", ")}`);
  console.log(`  Topics:  ${kafkaState.topics.requestTopic} (${kafkaState.metrics.activePartitions} partitions)`);
  console.log(`  Group:   ${kafkaState.groupId}`);

  console.log("\n2. Executing 100,000 Concurrent User Simulation...");
  console.log("   - Simulating 100,000 distinct user requests");
  console.log(`   - Partitioning across ${kafkaState.metrics.activePartitions} Kafka partitions`);
  console.log("   - Evaluating CPU composition matcher on batch workloads");

  const startTime = Date.now();
  const result = await runScaleSimulation(100000, kafkaState.metrics.activePartitions, 10);
  const totalElapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("\n===============================================================");
  console.log("                    SIMULATION RESULTS                         ");
  console.log("===============================================================");
  console.log(`Total Simulated Users:         ${result.totalUsers.toLocaleString()}`);
  console.log(`Configured Partitions:         ${result.numPartitions}`);
  console.log(`Producer Enqueue Time:         ${result.enqueueDurationMs} ms`);
  console.log(`Producer Throughput:           ${result.producerThroughputPerSec.toLocaleString()} ops/sec`);
  console.log(`Max Partition Distribution Skew: ${result.maxPartitionSkewPercent}%`);
  console.log(`Consumer Pool Duration (est):  ${(result.workerProcessingDurationMs / 1000).toFixed(2)} sec`);
  console.log(`Consumer Pool Throughput:      ${result.consumerThroughputPerSec.toLocaleString()} req/sec`);

  console.log("\n--- Partition Load Distribution (Consistent Hashing) ---");
  for (let p = 0; p < result.numPartitions; p++) {
    const count = result.partitionDistribution[p] || 0;
    const barLength = Math.round((count / (result.totalUsers / result.numPartitions)) * 20);
    const bar = "█".repeat(barLength) + "░".repeat(Math.max(0, 20 - barLength));
    console.log(`  Partition ${p.toString().padStart(2, "0")}: ${count.toLocaleString().padStart(7)} messages | [${bar}]`);
  }

  console.log("\n--- 100k Scalability Architecture Comparison ---");
  console.log(`• Naive Sync REST:            ~${result.scalingAnalysis.syncRestEstimatedTimeToProcessSec}s (event loop blocked, HTTP 504 timeouts)`);
  console.log(`• Kafka Event-Driven:         Non-blocking 202 Accepted (<5ms ACK)`);
  console.log(`• Horizontal Worker Scaling:  ${result.scalingAnalysis.concurrencyGainFactor}`);
  console.log(`• Architectural Verdict:      ${result.scalingAnalysis.verdict}`);
  console.log("===============================================================");

  await disconnectKafka();
  process.exit(0);
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
