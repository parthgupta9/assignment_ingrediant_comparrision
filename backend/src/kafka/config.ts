export interface KafkaConfiguration {
  brokers: string[];
  clientId: string;
  groupId: string;
  requestTopic: string;
  resultTopic: string;
  dlqTopic: string;
  numPartitions: number;
  replicationFactor: number;
  connectionTimeoutMs: number;
  useEmulatorIfBrokerUnavailable: boolean;
}

export const KAFKA_CONFIG: KafkaConfiguration = {
  brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  clientId: process.env.KAFKA_CLIENT_ID || "ingredient-matcher-service",
  groupId: process.env.KAFKA_GROUP_ID || "ingredient-matcher-workers",
  requestTopic: process.env.KAFKA_REQUEST_TOPIC || "ingredient-match-requests",
  resultTopic: process.env.KAFKA_RESULT_TOPIC || "ingredient-match-results",
  dlqTopic: process.env.KAFKA_DLQ_TOPIC || "ingredient-match-dlq",
  // 16-32 partitions allow linear horizontal scaling across multiple worker instances
  numPartitions: parseInt(process.env.KAFKA_NUM_PARTITIONS || "16", 10),
  replicationFactor: parseInt(process.env.KAFKA_REPLICATION_FACTOR || "1", 10),
  connectionTimeoutMs: parseInt(process.env.KAFKA_CONNECTION_TIMEOUT || "2500", 10),
  useEmulatorIfBrokerUnavailable: process.env.KAFKA_FORCE_REAL !== "true",
};
