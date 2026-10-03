import type { GameEngine, Move, Player } from '../common/types.js';

export const SIZE = 8;
const EMPTY = 0, BLACK = 1, WHITE = 2;
export type Cell = typeof EMPTY | typeof BLACK | typeof WHITE;

export interface ReversiState {
  grid: Cell[][];
  currentPlayer: Player;
  status: 'playing' | 'won';
  winner: Player | null;
  validMoves: Move[];
  lastMove: Move | null;
  blackScore: number;
  whiteScore: number;
}

const toCell = (p: Player): Cell => (p === 'black' ? BLACK : WHITE);
const opponentCell = (c: Cell): Cell => (c === BLACK ? WHITE : c === WHITE ? BLACK : EMPTY);

function inBounds(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function newGrid(): Cell[][] {
  const g: Cell[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
  g[3][3] = BLACK; g[3][4] = WHITE;
  g[4][3] = WHITE; g[4][4] = BLACK;
  return g;
}

function flipsInDir(grid: Cell[][], player: Cell, row: number, col: number, dr: number, dc: number): Move[] {
  const flips: Move[] = [];
  let r = row + dr, c = col + dc;
  while (inBounds(r, c) && grid[r][c] === opponentCell(player)) {
    flips.push({ row: r, col: c });
    r += dr; c += dc;
  }
  return flips.length > 0 && inBounds(r, c) && grid[r][c] === player ? flips : [];
}

function wouldFlip(grid: Cell[][], player: Cell, row: number, col: number): Move[] {
  if (!inBounds(row, col) || grid[row][col] !== EMPTY) return [];
  const out: Move[] = [];
  for (const dr of [-1, 0, 1]) for (const dc of [-1, 0, 1]) {
    if (dr === 0 && dc === 0) continue;
    out.push(...flipsInDir(grid, player, row, col, dr, dc));
  }
  return out;
}

function potentialMoves(grid: Cell[][], player: Cell): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    if (grid[r][c] === EMPTY && wouldFlip(grid, player, r, c).length > 0) moves.push({ row: r, col: c });
  }
  return moves;
}

function count(grid: Cell[][], cell: Cell): number {
  return grid.flat().filter((c) => c === cell).length;
}

function copyGrid(g: Cell[][]): Cell[][] {
  return g.map((r) => [...r]);
}

export class ReversiEngine implements GameEngine<ReversiState> {
  initial(): ReversiState {
    const grid = newGrid();
    return {
      grid,
      currentPlayer: 'black',
      status: 'playing',
      winner: null,
      validMoves: potentialMoves(grid, BLACK),
      lastMove: null,
      blackScore: 2,
      whiteScore: 2,
    };
  }

  getMoves(state: ReversiState): Move[] {
    return state.validMoves;
  }

  applyMove(state: ReversiState, move: Move): ReversiState {
    if (state.status !== 'playing') throw new Error('game over');
    const legal = state.validMoves.some((m) => m.row === move.row && m.col === move.col);
    if (!legal) throw new Error('illegal move');

    const grid = copyGrid(state.grid);
    const me = toCell(state.currentPlayer);
    const flips = wouldFlip(grid, me, move.row, move.col);
    grid[move.row][move.col] = me;
    for (const f of flips) grid[f.row][f.col] = me;

    const blackScore = count(grid, BLACK);
    const whiteScore = count(grid, WHITE);
    const next = state.currentPlayer === 'black' ? 'white' : 'black';
    let nextMoves = potentialMoves(grid, toCell(next));

    if (nextMoves.length === 0) {
      const againMoves = potentialMoves(grid, me);
      if (againMoves.length === 0) {
        return {
          grid, currentPlayer: state.currentPlayer, status: 'won',
          winner: blackScore > whiteScore ? 'black' : blackScore < whiteScore ? 'white' : null,
          validMoves: [], lastMove: move, blackScore, whiteScore,
        };
      }
      return { ...state, grid, currentPlayer: state.currentPlayer, validMoves: againMoves, lastMove: move, blackScore, whiteScore };
    }
    return { ...state, grid, currentPlayer: next, validMoves: nextMoves, lastMove: move, blackScore, whiteScore };
  }

  isTerminal(state: ReversiState): boolean {
    return state.status !== 'playing';
  }

  result(state: ReversiState): Player | 'draw' | null {
    if (state.status !== 'won') return null;
    return state.winner ?? 'draw';
  }

  toJSON(state: ReversiState): unknown {
    return state;
  }
}
