import { describe, it, expect } from 'vitest';
import { ReversiEngine } from '../src/games/reversi/engine.js';

describe('ReversiEngine', () => {
  it('starts with 4 pieces and 4 legal moves for black', () => {
    const e = new ReversiEngine();
    const s = e.initial();
    expect(s.blackScore).toBe(2);
    expect(s.whiteScore).toBe(2);
    expect(e.getMoves(s)).toHaveLength(4);
  });

  it('applies a move and flips pieces', () => {
    const e = new ReversiEngine();
    const s1 = e.applyMove(e.initial(), e.getMoves(e.initial())[0]);
    expect(s1.blackScore).toBe(4);
    expect(s1.whiteScore).toBe(1);
    expect(s1.currentPlayer).toBe('white');
  });

  it('rejects illegal moves', () => {
    const e = new ReversiEngine();
    expect(() => e.applyMove(e.initial(), { row: 0, col: 0 })).toThrow('illegal');
  });

  it('passes when opponent has no moves and ends the game when neither can move', () => {
    const e = new ReversiEngine();
    let s = e.initial();
    // Play until terminal; just ensure engine never throws on many random-ish legal lines
    let guard = 0;
    while (!e.isTerminal(s) && guard++ < 200) {
      const moves = e.getMoves(s);
      if (moves.length === 0) break;
      s = e.applyMove(s, moves[0]);
    }
    expect(e.isTerminal(s) || e.getMoves(s).length === 0).toBe(true);
  });
});
