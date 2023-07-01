import ChessGame from '$lib/ChessGame';
import { beforeEach, describe, expect, test } from '@jest/globals';

type ChessMovementTest = {
  moves: string[][];
  fen: string;
  title: string;
  explanation: string;
};

describe('chess game', () => {
  let chessGame = new ChessGame();

  beforeEach(() => {
    chessGame = new ChessGame();
  });

  test.each<ChessMovementTest>`
    moves             | fen                                                             | title                 | explanation
    ${[['a2', 'a3']]} | ${'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR b KQkq - 0 1'}  | ${'pawn advancement'} | ${'from a2 to a3'}
    ${[['a2', 'a4']]} | ${'rnbqkbnr/pppppppp/8/8/P7/8/1PPPPPPP/RNBQKBNR b KQkq - 0 1'}  | ${'pawn advancement'} | ${'from a2 to a4'}
    ${[['b2', 'b3']]} | ${'rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from b2 to b3'}
    ${[['b2', 'b4']]} | ${'rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from b2 to b4'}
    ${[['c2', 'c3']]} | ${'rnbqkbnr/pppppppp/8/8/8/2P5/PP1PPPPP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from c2 to c3'}
    ${[['c2', 'c4']]} | ${'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from c2 to c4'}
    ${[['d2', 'd3']]} | ${'rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from d2 to d3'}
    ${[['d2', 'd4']]} | ${'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from d2 to d4'}
    ${[['e2', 'e3']]} | ${'rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from e2 to e3'}
    ${[['e2', 'e4']]} | ${'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from e2 to e4'}
    ${[['f2', 'f3']]} | ${'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from f2 to f3'}
    ${[['f2', 'f4']]} | ${'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from f2 to f4'}
    ${[['g2', 'g3']]} | ${'rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from g2 to g3'}
    ${[['g2', 'g4']]} | ${'rnbqkbnr/pppppppp/8/8/6P1/8/PPPPPP1P/RNBQKBNR b KQkq - 0 1'} | ${'pawn advancement'} | ${'from g2 to g4'}
    ${[['h2', 'h3']]} | ${'rnbqkbnr/pppppppp/8/8/8/7P/PPPPPPP1/RNBQKBNR b KQkq - 0 1'}  | ${'pawn advancement'} | ${'from h2 to h3'}
    ${[['h2', 'h4']]} | ${'rnbqkbnr/pppppppp/8/8/7P/8/PPPPPPP1/RNBQKBNR b KQkq - 0 1'}  | ${'pawn advancement'} | ${'from h2 to h4'}
  `('$title: $explanation', ({ moves, fen }) => {
    for (const [start, target] of moves) {
      expect(chessGame.applyMove(start, target)).toBe(true);
    }
    expect(chessGame.fen).toBe(fen);
  });
});
