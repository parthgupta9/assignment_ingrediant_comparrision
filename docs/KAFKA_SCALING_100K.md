# Kafka Event-Driven Architecture & 100k Users Scalability Strategy

This document outlines the architecture, implementation, and mathematical rationale for using **Apache Kafka** to scale the Ingredient Composition Matching engine to **100,000+ concurrent users**.

---

## 1. Problem Statement: Why Synchronous REST Fails at 100k Users

Evaluating pharma product compositions requires floating-point comparisons across multiple active ingredients and excipients, applying tolerance window filters ($\pm \text{pp}$), checking extra-ingredient thresholds, and computing normalized L1 Manhattan distance.

When 100,000 users issue concurrent matching requests to a traditional REST API:
- **Event Loop Blocking**: Node.js operates on a single-threaded event loop. Executing CPU-intensive matching synchronously stalls the loop.
- **HTTP Gateway Timeouts**: Under sudden bursts, connections pile up in socket queues, leading to HTTP 504 Gateway Timeouts and dropped requests.
- **Resource Exhaustion**: Memory grows unbounded trying to retain 100,000 in-flight HTTP requests simultaneously.

---

## 2. Kafka Decoupled Architecture

By introducing Kafka as an event backbone, we decouple HTTP ingress from CPU-intensive match evaluation:

```
[ 100,000 Users ]
       │
       ▼
[ HTTP API Gateway ] ──(Immediate HTTP 202 Accepted, < 5ms ACK)──> [ Client Polling / SSE ]
       │
       │ (Key: userId, Compression: GZIP)
       ▼
==================== APACHE KAFKA TOPIC CLUSTER ====================
Topic: ingredient-match-requests (16 Partitions)
  [ Partition 0 ] ────► [ Consumer Worker 1 ]
  [ Partition 1 ] ────► [ Consumer Worker 2 ]
  ...
  [ Partition 15] ────► [ Consumer Worker 16 ]
====================================================================
       │
       ▼ (Processed in Parallel Micro-batches)
[ Match Evaluation Engine (matchCatalog) ]
       │
       ├─────────────────────────────────────────┐
       ▼                                         ▼
Topic: ingredient-match-results           Topic: ingredient-match-dlq
(Published to results topic & Cache)      (Failed/poisonous messages)
```

---

## 3. Core Architectural Pillars for 100k Scale

### 1. Fast, Non-Blocking Ingress (`POST /api/match/async`)
- The API Gateway does not execute matching algorithms inline.
- It validates payload schemas via Zod, generates a deterministic `jobId`, publishes an event to Kafka via `publishMatchJob()`, and immediately responds with **HTTP 202 Accepted**:
  ```json
  {
    "message": "Match request successfully queued into Kafka pipeline",
    "jobId": "job_1731609800_4f9a",
    "userId": "user_pharma_9942",
    "status": "QUEUED",
    "assignedPartition": 7,
    "checkStatusUrl": "/api/match/jobs/job_1731609800_4f9a"
  }
  ```
- Gateway response latency drops from seconds to **under 5 milliseconds**, allowing the gateway to absorb bursts of 50,000+ to 1,000,000+ requests per second without breaking connection limits.

### 2. Uniform Consistent Hashing & Zero Hotspotting
- Partition key: `userId`.
- Uses a 32-bit FNV-1a hash with Murmur3 avalanche mixing (`fmix32`):
  $$\text{Partition} = \text{hash}(\text{userId}) \pmod N$$
- **Guaranteed FIFO per user**: Any subsequent request or cancellation from the same user lands on the exact same partition in strictly sequential order.
- **Load distribution**: Spreads 100,000 users uniformly across all $N$ partitions with $< 3\%$ skew, eliminating partition hotspotting.

### 3. Partition-Based Horizontal Worker Scaling
- In Kafka, partitions are the fundamental unit of parallelism.
- A consumer group (`ingredient-matcher-workers`) coordinates worker instances.
- Adding partitions (e.g. 16, 32, or 64 partitions) enables spinning up an equal number of worker nodes or worker threads to execute matching in parallel with zero lock contention.

### 4. Backpressure & Micro-Batching
- If matching takes longer than ingestion, messages safely buffer on Kafka’s append-only disk log.
- Consumer workers pull micro-batches (e.g. 50–200 jobs per tick), keeping worker CPU utilization bounded at steady-state and preventing out-of-memory crashes.

### 5. Fault-Tolerance & Dead-Letter Queue (DLQ)
- Malformed inputs or unhandled runtime exceptions are routed to `ingredient-match-dlq` after configured retries.
- A single corrupted message never halts processing for the remaining 99,999 users.

---

## 4. Implementation Details

### Connection Function (`connectKafka`)
The `connectKafka()` function connects the producer, consumer group, and admin client:
```typescript
import { connectKafka } from "./kafka/client.js";

const state = await connectKafka();
console.log(state.connected, state.mode, state.topics);
```
- **Zero-downtime resilience**: If a real Kafka cluster is reachable at `localhost:9092`, it connects to KafkaJS Producer, Consumer, and Admin.
- **Graceful Local Fallback**: If external Kafka infrastructure is not running locally, it switches cleanly to an in-memory Partitioned Emulation engine with 16 virtual partitions, allowing developer onboarding, unit tests, and the 100k scale simulation to execute without requiring Docker.

### Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` | `/api/kafka/status` | Returns Kafka connection state, mode, topics, active partitions, and queue metrics |
| `POST` | `/api/match/async` | Non-blocking Kafka producer ingestion; returns 202 Accepted |
| `GET` | `/api/match/jobs/:id` | Polls status and retrieves processed match results for a job |
| `POST` | `/api/kafka/simulate-scale` | Runs simulated 100k users concurrency test across 16 partitions |

---

## 5. Verification & Benchmark

Run the automated test suite (21 unit and integration tests):
```bash
cd backend
npm test
```

Run the standalone 100k users scale benchmark:
```bash
cd backend
npm run kafka:benchmark
```

### Benchmark Output Sample:
```text
===============================================================
   KAFKA 100K USERS SCALABILITY BENCHMARK & ARCHITECTURE DEMO 
===============================================================
Total Simulated Users:         100,000
Configured Partitions:         16
Producer Enqueue Time:         49 ms
Producer Throughput:           2,040,816 ops/sec
Max Partition Distribution Skew: 2.9%
Consumer Pool Duration (est):  0.73 sec
Consumer Pool Throughput:      136,612 req/sec

--- Partition Load Distribution (Consistent Hashing) ---
  Partition 00:   6,260 messages | [████████████████████]
  Partition 01:   6,224 messages | [████████████████████]
  ...
  Partition 15:   6,219 messages | [████████████████████]

--- 100k Scalability Architecture Comparison ---
• Naive Sync REST:            ~12s (event loop blocked, HTTP 504 timeouts)
• Kafka Event-Driven:         Non-blocking 202 Accepted (<5ms ACK)
• Horizontal Worker Scaling:  16x horizontal scale across 16 consumer partitions
• Architectural Verdict:      Kafka decouples HTTP ingress from CPU-intensive matching.
```
