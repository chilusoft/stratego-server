import { updateRatings } from '../rating/elo.js';

export interface LeaderboardEntry {
  playerId: string;
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface MatchRecord {
  id: number;
  game: string;
  players: { playerId: string; name: string }[];
  winnerId: string | null;
  reason: string;
  at: number;
}

/** In-memory store for v1; swap for PostgreSQL in Phase 7. */
export class LeaderboardStore {
  private entries = new Map<string, Map<string, LeaderboardEntry>>(); // game -> playerId -> entry
  private history: MatchRecord[] = [];
  private seq = 0;

  private bucket(game: string) {
    let b = this.entries.get(game);
    if (!b) this.entries.set(game, (b = new Map()));
    return b;
  }

  private ensure(game: string, playerId: string, name: string): LeaderboardEntry {
    const b = this.bucket(game);
    let e = b.get(playerId);
    if (!e) b.set(playerId, (e = { playerId, name, rating: 1000, wins: 0, losses: 0, draws: 0 }));
    e.name = name;
    return e;
  }

  recordMatch(game: string, a: { playerId: string; name: string }, b: { playerId: string; name: string }, winnerId: string | null, reason: string) {
    const ea = this.ensure(game, a.playerId, a.name);
    const eb = this.ensure(game, b.playerId, b.name);
    let scoreA = 0.5;
    if (winnerId === a.playerId) { scoreA = 1; ea.wins++; eb.losses++; }
    else if (winnerId === b.playerId) { scoreA = 0; eb.wins++; ea.losses++; }
    else { ea.draws++; eb.draws++; }
    const [ra, rb] = updateRatings(ea.rating, eb.rating, scoreA);
    ea.rating = ra; eb.rating = rb;
    this.history.push({ id: ++this.seq, game, players: [a, b], winnerId, reason, at: Date.now() });
  }

  top(game: string, limit = 50): LeaderboardEntry[] {
    return [...this.bucket(game).values()].sort((x, y) => y.rating - x.rating).slice(0, limit);
  }

  historyFor(playerId: string, limit = 20): MatchRecord[] {
    return this.history.filter((m) => m.players.some((p) => p.playerId === playerId)).slice(-limit).reverse();
  }
}
