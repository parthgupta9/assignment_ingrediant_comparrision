import { MatchJobRecord } from "./types.js";

// In-memory Job Store with TTL / max limit for fast retrieval
class JobStore {
  private jobs = new Map<string, MatchJobRecord>();
  private readonly maxJobs = 10000;

  public set(jobId: string, record: MatchJobRecord): void {
    if (this.jobs.size >= this.maxJobs) {
      // Remove oldest item
      const firstKey = this.jobs.keys().next().value;
      if (firstKey) {
        this.jobs.delete(firstKey);
      }
    }
    this.jobs.set(jobId, record);
  }

  public get(jobId: string): MatchJobRecord | undefined {
    return this.jobs.get(jobId);
  }

  public update(jobId: string, updates: Partial<MatchJobRecord>): MatchJobRecord | undefined {
    const existing = this.jobs.get(jobId);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.jobs.set(jobId, updated);
    return updated;
  }

  public clear(): void {
    this.jobs.clear();
  }

  public size(): number {
    return this.jobs.size;
  }
}

export const jobStore = new JobStore();
