import { updateRatings } from '../rating/elo.js';

export interface LeaderboardEntry {
  name: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface MatchRecord {
  id: number;
  game: string;
  players: { name: string }[];
  winnerName: string | null;
  reason: string;
  at: number;
}

/** In-memory store for v1; swap for PostgreSQL in Phase 7. Keyed by unique player name. */
export class LeaderboardStore {
  private entries = new Map<string, Map<string, LeaderboardEntry>>(); // game -> playerName -> entry
  private history: MatchRecord[] = [];
  private seq = 0;

  private bucket(game: string) {
    let b = this.entries.get(game);
    if (!b) this.entries.set(game, (b = new Map()));
    return b;
  }

  private ensure(game: string, name: string): LeaderboardEntry {
    const b = this.bucket(game);
    let e = b.get(name);
    if (!e) b.set(name, (e = { name, rating: 1000, wins: 0, losses: 0, draws: 0 }));
    return e;
  }

  recordMatch(game: string, aName: string, bName: string, winnerName: string | null, reason: string) {
    const ea = this.ensure(game, aName);
    const eb = this.ensure(game, bName);
    let scoreA = 0.5;
    if (winnerName === aName) { scoreA = 1; ea.wins++; eb.losses++; }
    else if (winnerName === bName) { scoreA = 0; eb.wins++; ea.losses++; }
    else { ea.draws++; eb.draws++; }
    const [ra, rb] = updateRatings(ea.rating, eb.rating, scoreA);
    ea.rating = ra; eb.rating = rb;
    this.history.push({ id: ++this.seq, game, players: [{ name: aName }, { name: bName }], winnerName, reason, at: Date.now() });
  }

  top(game: string, limit = 50): LeaderboardEntry[] {
    return [...this.bucket(game).values()].sort((x, y) => y.rating - x.rating).slice(0, limit);
  }

  historyFor(name: string, limit = 20): MatchRecord[] {
    return this.history.filter((m) => m.players.some((p) => p.name === name)).slice(-limit).reverse();
  }
}
