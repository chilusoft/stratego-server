import { describe, it, expect } from 'vitest';
import { LeaderboardStore } from '../src/leaderboard/store.js';
import { expectedScore, updateRatings } from '../src/rating/elo.js';

describe('elo', () => {
  it('equal ratings expect ~0.5', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });
  it('winner gains, loser drops by same amount', () => {
    const [ra, rb] = updateRatings(1000, 1000, 1);
    expect(ra).toBe(1016);
    expect(rb).toBe(984);
  });
});

describe('LeaderboardStore', () => {
  it('records a win and updates ratings/history', () => {
    const s = new LeaderboardStore();
    s.recordMatch('reversi', { playerId: 'a', name: 'A' }, { playerId: 'b', name: 'B' }, 'a', 'completed');
    const top = s.top('reversi');
    expect(top[0].playerId).toBe('a');
    expect(top[0].wins).toBe(1);
    expect(top[0].rating).toBe(1016);
    expect(top[1].rating).toBe(984);
    expect(s.historyFor('b')).toHaveLength(1);
  });

  it('draw keeps ratings equal', () => {
    const s = new LeaderboardStore();
    s.recordMatch('reversi', { playerId: 'a', name: 'A' }, { playerId: 'b', name: 'B' }, null, 'completed');
    expect(s.top('reversi')[0].rating).toBe(1000);
    expect(s.top('reversi')[0].draws).toBe(1);
  });
});
