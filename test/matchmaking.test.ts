import { describe, it, expect } from 'vitest';
import { MatchmakingQueue } from '../src/matchmaking/queue.js';

describe('MatchmakingQueue', () => {
  it('pairs two players in the same mode', () => {
    const q = new MatchmakingQueue();
    const matches: any[] = [];
    q.onMatch = (m) => matches.push(m);
    q.join({ playerId: 'p1', name: 'a', mode: 'reversi', joinedAt: 1 });
    expect(matches).toHaveLength(0);
    q.join({ playerId: 'p2', name: 'b', mode: 'reversi', joinedAt: 2 });
    expect(matches).toHaveLength(1);
    expect(matches[0].mode).toBe('reversi');
  });

  it('does not pair across different modes', () => {
    const q = new MatchmakingQueue();
    const matches: any[] = [];
    q.onMatch = (m) => matches.push(m);
    q.join({ playerId: 'p1', name: 'a', mode: 'reversi', joinedAt: 1 });
    q.join({ playerId: 'p2', name: 'b', mode: 'chess', joinedAt: 2 });
    expect(matches).toHaveLength(0);
    expect(q.size()).toBe(2);
  });

  it('leave removes a queued player', () => {
    const q = new MatchmakingQueue();
    const matches: any[] = [];
    q.onMatch = (m) => matches.push(m);
    q.join({ playerId: 'p1', name: 'a', mode: 'reversi', joinedAt: 1 });
    q.leave('p1');
    q.join({ playerId: 'p2', name: 'b', mode: 'reversi', joinedAt: 2 });
    expect(matches).toHaveLength(0);
  });
});
