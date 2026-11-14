import { Product, MatchConfig, MatchResponse } from "../types.js";

export interface MatchJobRequest {
  jobId: string;
  userId: string;
  timestamp: number;
  reference_product: Product;
  catalog: Product[];
  config?: MatchConfig;
}

export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface MatchJobRecord {
  jobId: string;
  userId: string;
  status: JobStatus;
  createdAt: string;
  completedAt?: string;
  processingTimeMs?: number;
  partition: number;
  response?: MatchResponse;
  error?: string;
}

export interface KafkaMetrics {
  jobsQueued: number;
  jobsProcessed: number;
  jobsFailed: number;
  activePartitions: number;
  avgLatencyMs: number;
  totalThroughputPerSec: number;
  partitionDistribution: Record<number, number>;
}

export interface KafkaConnectionState {
  connected: boolean;
  mode: "REAL_BROKER" | "EMULATED" | "DISCONNECTED";
  brokers: string[];
  clientId: string;
  groupId: string;
  topics: {
    requestTopic: string;
    resultTopic: string;
    dlqTopic: string;
  };
  metrics: KafkaMetrics;
}
