"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jobStore = void 0;
// In-memory Job Store with TTL / max limit for fast retrieval
class JobStore {
    jobs = new Map();
    maxJobs = 10000;
    set(jobId, record) {
        if (this.jobs.size >= this.maxJobs) {
            // Remove oldest item
            const firstKey = this.jobs.keys().next().value;
            if (firstKey) {
                this.jobs.delete(firstKey);
            }
        }
        this.jobs.set(jobId, record);
    }
    get(jobId) {
        return this.jobs.get(jobId);
    }
    update(jobId, updates) {
        const existing = this.jobs.get(jobId);
        if (!existing)
            return undefined;
        const updated = { ...existing, ...updates };
        this.jobs.set(jobId, updated);
        return updated;
    }
    clear() {
        this.jobs.clear();
    }
    size() {
        return this.jobs.size;
    }
}
exports.jobStore = new JobStore();
