export type Player = 'black' | 'white';

export interface Move {
  row: number;
  col: number;
}

export interface GameEngine<S> {
  initial(): S;
  /** Legal moves for the player to move in this state. */
  getMoves(state: S): Move[];
  /** Returns a new state after applying the move; throws/ignores illegal moves. */
  applyMove(state: S, move: Move): S;
  isTerminal(state: S): boolean;
  /** 'black' | 'white' | 'draw' | null (null if still in progress). */
  result(state: S): Player | 'draw' | null;
  toJSON(state: S): unknown;
}
