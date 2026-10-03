export interface QueueEntry {
  playerId: string;
  name: string;
  mode: string; // e.g. 'reversi', 'chess', 'checkers'
  rating?: number;
  joinedAt: number;
}

export interface MatchResult {
  mode: string;
  a: QueueEntry;
  b: QueueEntry;
}

/**
 * Simple FIFO matchmaking per game mode. Pairs the two longest-waiting
 * players in the same mode. `rating` is reserved for Phase 4 Elo pairing.
 */
export class MatchmakingQueue {
  private queues = new Map<string, QueueEntry[]>();
  onMatch: ((match: MatchResult) => void) | null = null;

  join(entry: QueueEntry): void {
    const q = this.queues.get(entry.mode) ?? [];
    q.push(entry);
    this.queues.set(entry.mode, q);
    this.tryPair(entry.mode);
  }

  leave(playerId: string): boolean {
    for (const [mode, q] of this.queues) {
      const idx = q.findIndex((e) => e.playerId === playerId);
      if (idx >= 0) {
        q.splice(idx, 1);
        this.queues.set(mode, q);
        return true;
      }
    }
    return false;
  }

  size(mode?: string): number {
    if (mode) return this.queues.get(mode)?.length ?? 0;
    return [...this.queues.values()].reduce((n, q) => n + q.length, 0);
  }

  private tryPair(mode: string) {
    const q = this.queues.get(mode) ?? [];
    while (q.length >= 2) {
      const a = q.shift()!;
      const b = q.shift()!;
      this.onMatch?.({ mode, a, b });
    }
    this.queues.set(mode, q);
  }
}
