import { describe, it, expect, vi } from 'vitest';
import { ReversiRoom } from '../src/rooms/room.js';

describe('ReversiRoom', () => {
  it('activates when two players join and allows a legal move', () => {
    const room = new ReversiRoom('r1', 60_000);
    room.addPlayer('p1', 'a');
    room.addPlayer('p2', 'b');
    expect(room.status).toBe('active');
    const snap = room.snapshot();
    const move = snap.state!.validMoves[0];
    room.move('p1', move); // black moves first
    expect(room.snapshot().state!.blackScore).toBe(4);
  });

  it('rejects moves out of turn', () => {
    const room = new ReversiRoom('r2', 60_000);
    room.addPlayer('p1', 'a');
    room.addPlayer('p2', 'b');
    expect(() => room.move('p2', { row: 2, col: 3 })).toThrow('not your turn');
  });

  it('times out the current player', () => {
    vi.useFakeTimers();
    const room = new ReversiRoom('r3', 1000);
    room.addPlayer('p1', 'a');
    room.addPlayer('p2', 'b');
    vi.advanceTimersByTime(1500);
    expect(room.status).toBe('finished');
    expect(room.winner).toBe('white');
    expect(room.reason).toBe('timeout');
    vi.useRealTimers();
  });

  it('resign finishes the game', () => {
    const room = new ReversiRoom('r4', 60_000);
    room.addPlayer('p1', 'a');
    room.addPlayer('p2', 'b');
    room.resign('p1');
    expect(room.winner).toBe('white');
    expect(room.reason).toBe('resignation');
  });
});
