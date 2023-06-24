import { createCanvas } from 'canvas';

export type PieceColor = 'white' | 'black';
export type File = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h';
export type Row<T> = Record<File, T | null>;
export type Board = Row<Piece>[];

export enum PieceType {
  pawn,
  rook,
  knight,
  bishop,
  king,
  queen,
}

export class Piece {
  #type: PieceType;
  #color: PieceColor;

  constructor(type: PieceType, color: PieceColor) {
    this.#type = type;
    this.#color = color;
  }

  get type() {
    return this.#type;
  }

  get color() {
    return this.#color;
  }
}

export default class ChessGame {
  #board: Board;

  constructor() {
    const EMPTY_ROW: Row<Piece> = {
      a: null,
      b: null,
      c: null,
      d: null,
      e: null,
      f: null,
      g: null,
      h: null,
    };

    const PAWN_ROW: Row<PieceType.pawn> = {
      a: PieceType.pawn,
      b: PieceType.pawn,
      c: PieceType.pawn,
      d: PieceType.pawn,
      e: PieceType.pawn,
      f: PieceType.pawn,
      g: PieceType.pawn,
      h: PieceType.pawn,
    };

    const BOTTOM_ROW: Row<PieceType> = {
      a: PieceType.rook,
      b: PieceType.knight,
      c: PieceType.bishop,
      d: PieceType.queen,
      e: PieceType.king,
      f: PieceType.bishop,
      g: PieceType.knight,
      h: PieceType.rook,
    };

    function generatePieces(
      row: Row<PieceType>,
      color: PieceColor
    ): Row<Piece> {
      return Object.fromEntries(
        Object.entries(row).map(([file, type]) => [
          file,
          type === null ? null : new Piece(type, color),
        ])
      ) as Row<Piece>;
    }

    this.#board = [
      generatePieces(BOTTOM_ROW, 'white'),
      generatePieces(PAWN_ROW, 'white'),
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      EMPTY_ROW,
      generatePieces(PAWN_ROW, 'black'),
      generatePieces(BOTTOM_ROW, 'black'),
    ];
  }

  generateBoardCanvasPNGData(perspectiveColor: PieceColor) {
    const FILES = 8;
    const RANKS = 8;

    const SQUARE_WIDTH = 60;
    const SQUARE_HEIGHT = 60;

    const BOARD_HEIGHT = SQUARE_HEIGHT * RANKS;
    const BOARD_WIDTH = SQUARE_WIDTH * FILES;

    const RANK_X_PADDING = 5;
    const RANK_Y_PADDING = 15;

    const FILE_X_PADDING = 15;
    const FILE_Y_PADDING = 5;

    const canvas = createCanvas(BOARD_WIDTH, BOARD_HEIGHT);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    for (const [rank, row] of (perspectiveColor === 'white'
      ? this.#board
      : this.#board.reverse()
    ).entries()) {
      for (const [file, piece] of Object.entries(row)) {
        const fileIndex = file.charCodeAt(0) - 'a'.charCodeAt(0);
        const isDarkSquare = rank % 2 === fileIndex % 2;

        ctx.fillStyle = isDarkSquare ? '#66BB6A' : 'white';

        const squareX = fileIndex * SQUARE_WIDTH;
        const squareY = rank * SQUARE_HEIGHT;
        ctx.fillRect(squareX, squareY, SQUARE_WIDTH, SQUARE_HEIGHT);

        ctx.fillStyle = isDarkSquare ? 'white' : '#779952';

        if (fileIndex === 0) {
          ctx.fillText(
            (perspectiveColor === 'white' ? RANKS - rank : rank + 1).toString(),
            squareX + RANK_X_PADDING,
            squareY + RANK_Y_PADDING
          );
        }

        if (rank + 1 === RANKS) {
          ctx.fillText(
            perspectiveColor === 'white'
              ? file
              : String.fromCharCode('h'.charCodeAt(0) - fileIndex),
            squareX + SQUARE_WIDTH - FILE_X_PADDING,
            squareY + SQUARE_HEIGHT - FILE_Y_PADDING
          );
        }

        if (piece === null) {
          continue;
        }

        switch (piece.type) {
          case PieceType.pawn:
          case PieceType.rook:
          case PieceType.knight:
          case PieceType.bishop:
          case PieceType.king:
          case PieceType.queen:
        }
      }
    }

    return ctx.canvas.toBuffer('image/png');
  }
}
