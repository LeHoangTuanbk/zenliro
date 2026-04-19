// In-process Room: lightweight broker for A2A messages between agents running
// in the same Electron main process. Kept behind a stable interface (send /
// broadcast / subscribe / publishArtifact / drainInbox) so we can swap the
// transport for real A2A HTTP servers later without changing callers.
//
// Each agent has an inbox (FIFO queue). A message sent 1:1 only lands in the
// recipient's inbox; broadcast fan-outs land in every other inbox. Subscribers
// also receive live notifications — used by the orchestrator/UI for streaming.

import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AgentCard, AgentId, Artifact, Message, RoomEnvelope } from './types';

export type RoomListener = (ev: RoomEnvelope) => void;
export type ArtifactListener = (a: { fromAgent: AgentId; artifact: Artifact }) => void;

export class AgentRoom {
  readonly sessionId: string;
  readonly createdAt = Date.now();
  private readonly bus = new EventEmitter();
  private readonly agents = new Map<AgentId, AgentCard>();
  private readonly inboxes = new Map<AgentId, RoomEnvelope[]>();
  private readonly history: RoomEnvelope[] = [];
  private readonly artifacts: Array<{ fromAgent: AgentId; artifact: Artifact }> = [];
  private iterationCounter = 0;

  constructor(sessionId?: string) {
    this.sessionId = sessionId ?? randomUUID();
    // Listeners may pile up on long-running sessions. Raise the ceiling to
    // avoid Node's unhelpful maxListeners warning without hiding real leaks.
    this.bus.setMaxListeners(32);
  }

  registerAgent(id: AgentId, card: AgentCard): void {
    this.agents.set(id, card);
    if (!this.inboxes.has(id)) this.inboxes.set(id, []);
  }

  getAgents(): Array<{ id: AgentId; card: AgentCard }> {
    return Array.from(this.agents.entries()).map(([id, card]) => ({ id, card }));
  }

  // Primary entry point. Routes message into the recipient's inbox(es), records
  // it in history, and broadcasts to live subscribers.
  send(params: {
    from: AgentId;
    to: AgentId | 'broadcast';
    message: Message;
    inReplyTo?: string;
  }): RoomEnvelope {
    const envelope: RoomEnvelope = {
      id: randomUUID(),
      from: params.from,
      to: params.to,
      message: params.message,
      inReplyTo: params.inReplyTo,
      iteration: this.iterationCounter,
      timestamp: Date.now(),
    };
    this.history.push(envelope);
    if (params.to === 'broadcast') {
      for (const agentId of this.agents.keys()) {
        if (agentId === params.from) continue;
        this.inboxes.get(agentId)?.push(envelope);
      }
    } else {
      this.inboxes.get(params.to)?.push(envelope);
    }
    this.bus.emit('message', envelope);
    return envelope;
  }

  publishArtifact(fromAgent: AgentId, artifact: Artifact): void {
    this.artifacts.push({ fromAgent, artifact });
    this.bus.emit('artifact', { fromAgent, artifact });
  }

  // Drains pending inbox for the given agent. Messages are removed after read
  // — standard FIFO queue semantics. Agents poll this via the MCP tool
  // a2a_subscribe_messages.
  drainInbox(agentId: AgentId): RoomEnvelope[] {
    const inbox = this.inboxes.get(agentId);
    if (!inbox || inbox.length === 0) return [];
    const drained = inbox.splice(0, inbox.length);
    return drained;
  }

  peekInbox(agentId: AgentId): number {
    return this.inboxes.get(agentId)?.length ?? 0;
  }

  getHistory(): RoomEnvelope[] {
    return this.history.slice();
  }

  getArtifacts(): Array<{ fromAgent: AgentId; artifact: Artifact }> {
    return this.artifacts.slice();
  }

  advanceIteration(): number {
    this.iterationCounter += 1;
    return this.iterationCounter;
  }

  currentIteration(): number {
    return this.iterationCounter;
  }

  onMessage(listener: RoomListener): () => void {
    this.bus.on('message', listener);
    return () => this.bus.off('message', listener);
  }

  onArtifact(listener: ArtifactListener): () => void {
    this.bus.on('artifact', listener);
    return () => this.bus.off('artifact', listener);
  }

  close(): void {
    this.bus.removeAllListeners();
    this.agents.clear();
    this.inboxes.clear();
  }
}
