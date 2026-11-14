/**
 * High-performance, uniform partitioner implementing FNV-1a with
 * Murmur3 32-bit avalanche mixing (similar to Kafka's Murmur2 partitioner).
 * Guarantees uniform distribution even across power-of-2 partition counts.
 */
export function getPartitionForUser(userId: string, numPartitions: number): number {
  if (numPartitions <= 0) return 0;

  let hash = 2166136261;
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  // Murmur3 32-bit avalanche mixer (fmix32)
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;

  return (hash >>> 0) % numPartitions;
}
