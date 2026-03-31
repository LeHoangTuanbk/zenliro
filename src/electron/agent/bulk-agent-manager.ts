import { ClaudeCodeManager } from './claude-code-manager.js';
import { CodexManager } from './codex-manager.js';
import { buildBulkEditPrompt } from './system-prompt.js';
import type { ParsedStreamEvent } from './stream-parser.js';
import { createLogger } from '../logger/index.js';

const log = createLogger('main/bulk-agent');

type AgentProvider = 'claude' | 'codex';

type ManagerLike = {
  sendMessage(
    text: string,
    onEvent: (event: ParsedStreamEvent) => void,
    options?: { model?: string; env?: Record<string, string> },
  ): void;
  stop(): void;
  isRunning(): boolean;
  setSessionId(id: string): void;
};

function createManager(provider: AgentProvider): ManagerLike {
  return provider === 'codex' ? new CodexManager() : new ClaudeCodeManager();
}

export type PhotoJobStatus = 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

export type PhotoJob = {
  photoId: string;
  status: PhotoJobStatus;
  agentIndex: number | null;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
};

export type BulkJobOptions = {
  prompt: string;
  model?: string;
  provider?: AgentProvider;
  parallelCount: number;
};

export type BulkJobEvent =
  | { type: 'job-status'; photoId: string; status: PhotoJobStatus; agentIndex: number | null }
  | { type: 'job-thinking'; photoId: string; agentIndex: number; text: string }
  | { type: 'job-text'; photoId: string; agentIndex: number; text: string }
  | { type: 'job-tool-use'; photoId: string; agentIndex: number; name: string }
  | { type: 'job-error'; photoId: string; error: string }
  | {
      type: 'all-done';
      summary: { total: number; done: number; failed: number; cancelled: number };
    };

export type BulkJobCallback = (event: BulkJobEvent) => void;

export class BulkAgentManager {
  private agents: ManagerLike[] = [];
  private queue: string[] = [];
  private jobs = new Map<string, PhotoJob>();
  private activeJobs = new Map<number, string>(); // agentIndex → photoId
  private onEvent: BulkJobCallback | null = null;
  private options: BulkJobOptions | null = null;
  private stopped = false;

  isRunning(): boolean {
    return this.agents.length > 0 && !this.stopped;
  }

  getJobs(): PhotoJob[] {
    return Array.from(this.jobs.values());
  }

  start(photoIds: string[], options: BulkJobOptions, onEvent: BulkJobCallback): void {
    this.stop();
    this.stopped = false;
    this.options = options;
    this.onEvent = onEvent;
    this.queue = [...photoIds];
    this.jobs.clear();
    this.activeJobs.clear();

    // Init all jobs as queued
    for (const photoId of photoIds) {
      this.jobs.set(photoId, {
        photoId,
        status: 'queued',
        agentIndex: null,
        startedAt: null,
        completedAt: null,
        error: null,
      });
    }

    // Create N agent instances using the correct provider
    const count = Math.min(options.parallelCount, photoIds.length, 5);
    const provider = options.provider ?? 'claude';
    log.info(
      `Starting bulk edit: ${photoIds.length} photos, ${count} agents, provider: ${provider}`,
    );

    for (let i = 0; i < count; i++) {
      const agent = createManager(provider);
      this.agents.push(agent);
      this.processNext(i);
    }
  }

  private processNext(agentIndex: number): void {
    if (this.stopped) return;

    const photoId = this.queue.shift();
    if (!photoId) {
      // No more work for this agent
      this.checkAllDone();
      return;
    }

    const job = this.jobs.get(photoId);
    if (!job) return;

    job.status = 'processing';
    job.agentIndex = agentIndex;
    job.startedAt = Date.now();
    this.activeJobs.set(agentIndex, photoId);

    this.emit({ type: 'job-status', photoId, status: 'processing', agentIndex });

    log.info(`Agent #${agentIndex} processing photo: ${photoId}`);

    const agent = this.agents[agentIndex];
    if (!agent) return;

    const prompt = buildBulkEditPrompt(photoId, this.options?.prompt ?? '');

    agent.sendMessage(
      prompt,
      (event: ParsedStreamEvent) => {
        if (this.stopped) return;

        switch (event.type) {
          case 'thinking':
            this.emit({ type: 'job-thinking', photoId, agentIndex, text: event.text });
            break;
          case 'text':
            this.emit({ type: 'job-text', photoId, agentIndex, text: event.text });
            break;
          case 'tool_use':
            this.emit({ type: 'job-tool-use', photoId, agentIndex, name: event.name });
            break;
          case 'session_id':
            agent.setSessionId(event.sessionId);
            break;
          case 'error':
            this.completeJob(photoId, agentIndex, 'error', event.error);
            break;
          case 'done':
            this.completeJob(photoId, agentIndex, 'done');
            break;
        }
      },
      {
        model: this.options?.model,
        env: { ZENLIRO_BULK_PHOTO_ID: photoId },
      },
    );
  }

  private completeJob(
    photoId: string,
    agentIndex: number,
    status: 'done' | 'error',
    error?: string,
  ): void {
    const job = this.jobs.get(photoId);
    if (!job) return;

    job.status = status;
    job.completedAt = Date.now();
    job.error = error ?? null;
    this.activeJobs.delete(agentIndex);

    log.info(
      `Agent #${agentIndex} ${status} photo: ${photoId}${error ? ` (${error})` : ''} in ${job.completedAt - (job.startedAt ?? job.completedAt)}ms`,
    );

    this.emit({ type: 'job-status', photoId, status, agentIndex });
    if (status === 'error' && error) {
      this.emit({ type: 'job-error', photoId, error });
    }

    // Process next photo
    this.processNext(agentIndex);
  }

  private checkAllDone(): void {
    if (this.activeJobs.size > 0) return;
    if (this.queue.length > 0) return;

    const all = Array.from(this.jobs.values());
    const done = all.filter((j) => j.status === 'done').length;
    const failed = all.filter((j) => j.status === 'error').length;
    const cancelled = all.filter((j) => j.status === 'cancelled').length;

    log.info(`Bulk edit complete: ${done} done, ${failed} failed, ${cancelled} cancelled`);

    this.emit({
      type: 'all-done',
      summary: { total: all.length, done, failed, cancelled },
    });
  }

  stopJob(photoId: string): void {
    // Find which agent is processing this photo
    for (const [agentIndex, activePhotoId] of this.activeJobs) {
      if (activePhotoId === photoId) {
        const agent = this.agents[agentIndex];
        if (agent) {
          agent.stop();
          // Replace with a fresh agent so the slot can process next photo
          const provider = this.options?.provider ?? 'claude';
          const newAgent = createManager(provider);
          this.agents[agentIndex] = newAgent;
        }
        const job = this.jobs.get(photoId);
        if (job) {
          job.status = 'cancelled';
          job.completedAt = Date.now();
        }
        this.activeJobs.delete(agentIndex);
        this.emit({ type: 'job-status', photoId, status: 'cancelled', agentIndex });
        log.info(`Stopped job for photo: ${photoId} (agent #${agentIndex})`);
        // Let this agent pick up next photo
        this.processNext(agentIndex);
        return;
      }
    }

    // If queued, just remove from queue
    const queueIdx = this.queue.indexOf(photoId);
    if (queueIdx >= 0) {
      this.queue.splice(queueIdx, 1);
      const job = this.jobs.get(photoId);
      if (job) {
        job.status = 'cancelled';
        job.completedAt = Date.now();
      }
      this.emit({ type: 'job-status', photoId, status: 'cancelled', agentIndex: null });
    }
  }

  stop(): void {
    this.stopped = true;

    // Cancel queued jobs
    for (const photoId of this.queue) {
      const job = this.jobs.get(photoId);
      if (job && job.status === 'queued') {
        job.status = 'cancelled';
        this.emit({ type: 'job-status', photoId, status: 'cancelled', agentIndex: null });
      }
    }
    this.queue = [];

    // Stop all agents
    for (const agent of this.agents) {
      agent.stop();
    }

    // Mark active jobs as cancelled
    for (const [agentIndex, photoId] of this.activeJobs) {
      const job = this.jobs.get(photoId);
      if (job && job.status === 'processing') {
        job.status = 'cancelled';
        job.completedAt = Date.now();
        this.emit({ type: 'job-status', photoId, status: 'cancelled', agentIndex });
      }
    }
    this.activeJobs.clear();

    this.agents = [];
    this.checkAllDone();
  }

  private emit(event: BulkJobEvent): void {
    this.onEvent?.(event);
  }
}
