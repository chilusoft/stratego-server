import { ReversiEngine, type ReversiState } from '../games/reversi/engine.js';
import type { Move, Player } from '../games/common/types.js';

export interface RoomPlayer {
  id: string;
  name: string;
  color: Player;
}

export interface RoomSnapshot {
  id: string;
  status: 'waiting' | 'active' | 'finished';
  players: RoomPlayer[];
  state: ReversiState | null;
  clock: { blackMs: number; whiteMs: number; turnStartedAt: number | null };
  winner: Player | 'draw' | null;
  reason: string | null;
}

export class ReversiRoom {
  readonly id: string;
  private engine = new ReversiEngine();
  private state: ReversiState | null = null;
  private players: RoomPlayer[] = [];
  status: 'waiting' | 'active' | 'finished' = 'waiting';
  private blackMs: number;
  private whiteMs: number;
  private turnStartedAt: number | null = null;
  winner: Player | 'draw' | null = null;
  reason: string | null = null;
  private listeners = new Set<(snapshot: RoomSnapshot) => void>();
  private timer: NodeJS.Timeout | null = null;

  addListener(fn: (snapshot: RoomSnapshot) => void) {
    this.listeners.add(fn);
  }

  constructor(id: string, timePerPlayerMs = 5 * 60_000) {
    this.id = id;
    this.blackMs = timePerPlayerMs;
    this.whiteMs = timePerPlayerMs;
  }

  get isOpen() {
    return this.status === 'waiting' && this.players.length < 2;
  }

  addPlayer(id: string, name: string): RoomPlayer {
    if (this.players.length >= 2) throw new Error('room full');
    const color: Player = this.players.length === 0 ? 'black' : 'white';
    const p = { id, name, color };
    this.players.push(p);
    if (this.players.length === 2) this.start(); else this.emit();
    return p;
  }

  private start() {
    this.status = 'active';
    this.state = this.engine.initial();
    this.turnStartedAt = Date.now();
    this.scheduleTimeout();
    this.emit();
  }

  move(playerId: string, move: Move): void {
    if (this.status !== 'active' || !this.state) throw new Error('not active');
    const p = this.players.find((pl) => pl.id === playerId);
    if (!p) throw new Error('not in room');
    if (p.color !== this.state.currentPlayer) throw new Error('not your turn');

    this.deductClock(p.color);
    this.state = this.engine.applyMove(this.state, move);
    this.turnStartedAt = Date.now();

    if (this.engine.isTerminal(this.state)) {
      this.finish(this.engine.result(this.state), 'completed');
      return;
    }
    this.scheduleTimeout();
    this.emit();
  }

  resign(playerId: string): void {
    const p = this.players.find((pl) => pl.id === playerId);
    if (!p || this.status !== 'active') return;
    this.finish(p.color === 'black' ? 'white' : 'black', 'resignation');
  }

  private deductClock(color: Player) {
    if (this.turnStartedAt == null) return;
    const elapsed = Date.now() - this.turnStartedAt;
    if (color === 'black') this.blackMs -= elapsed; else this.whiteMs -= elapsed;
  }

  private scheduleTimeout() {
    if (this.timer) clearTimeout(this.timer);
    if (!this.state || this.status !== 'active') return;
    const remaining = this.state.currentPlayer === 'black' ? this.blackMs : this.whiteMs;
    this.timer = setTimeout(() => {
      this.finish(this.state!.currentPlayer === 'black' ? 'white' : 'black', 'timeout');
    }, Math.max(remaining, 0));
  }

  private finish(winner: Player | 'draw' | null, reason: string) {
    this.status = 'finished';
    this.winner = winner;
    this.reason = reason;
    if (this.timer) clearTimeout(this.timer);
    this.turnStartedAt = null;
    this.emit();
  }

  snapshot(): RoomSnapshot {
    return {
      id: this.id,
      status: this.status,
      players: this.players,
      state: this.state,
      clock: { blackMs: this.blackMs, whiteMs: this.whiteMs, turnStartedAt: this.turnStartedAt },
      winner: this.winner,
      reason: this.reason,
    };
  }

  private emit() {
    for (const fn of this.listeners) fn(this.snapshot());
  }
}
