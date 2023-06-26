import { createCanvas, loadImage } from 'canvas';

export type PieceColor = 'white' | 'black';
export type Row<T> = Array<T | null>;
export type Board = Array<Row<Piece>>;

export enum PieceType {
  pawn = 'pawn',
  rook = 'rook',
  knight = 'knight',
  bishop = 'bishop',
  king = 'king',
  queen = 'queen',
}

export class Piece {
  type: PieceType;
  color: PieceColor;
  moves: number;

  constructor(type: PieceType, color: PieceColor) {
    this.type = type;
    this.color = color;
    this.moves = 0;
  }
}

export default class ChessGame {
  private board: Board;

  constructor() {
    const EMPTY_ROW: Row<Piece> = [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ];

    const PAWN_ROW: Row<PieceType.pawn> = [
      PieceType.pawn,
      PieceType.pawn,
      PieceType.pawn,
      PieceType.pawn,
      PieceType.pawn,
      PieceType.pawn,
      PieceType.pawn,
      PieceType.pawn,
    ];

    const WHITE_BOTTOM_ROW: Row<PieceType> = [
      PieceType.rook,
      PieceType.knight,
      PieceType.bishop,
      PieceType.queen,
      PieceType.king,
      PieceType.bishop,
      PieceType.knight,
      PieceType.rook,
    ];

    function generatePieces(
      row: Row<PieceType>,
      color: PieceColor
    ): Row<Piece> {
      return row.map((type) => (type === null ? null : new Piece(type, color)));
    }

    this.board = [
      generatePieces(WHITE_BOTTOM_ROW, 'white'),
      generatePieces(PAWN_ROW, 'white'),
      [...EMPTY_ROW],
      [...EMPTY_ROW],
      [...EMPTY_ROW],
      [...EMPTY_ROW],
      generatePieces(PAWN_ROW, 'black'),
      generatePieces(WHITE_BOTTOM_ROW, 'black'),
    ];

    Object.seal(this.board);
  }

  makeMove(start: string, end: string, promotion?: PieceType) {
    const startFile = start[0].charCodeAt(0) - 'a'.charCodeAt(0);
    const startRank = Number(start[1]) - 1;

    const endFile = end[0].charCodeAt(0) - 'a'.charCodeAt(0);
    const endRank = Number(end[1]) - 1;

    if (startRank > 7 || endRank > 7) {
      throw new Error('Cannot go outside borders of board.');
    }

    let startPiece = this.board[startRank][startFile];
    let endPiece = this.board[endRank][endFile];

    if (startPiece === null) {
      throw new Error("You can't move a piece that doesn't exist.");
    }

    const isWhitePiece = startPiece.color === 'white';

    switch (startPiece.type) {
      case PieceType.pawn:
        if (
          ((startPiece.moves === 0 &&
            startRank === endRank + (isWhitePiece ? -2 : 2)) ||
            startRank === endRank + (isWhitePiece ? -1 : 1)) &&
          ((startFile === endFile && endPiece === null) ||
            (Math.abs(endFile - startFile) === 1 && endPiece !== null))
        ) {
          endPiece = startPiece;
          startPiece = null;
        } else {
          throw new Error('Invalid pawn move.');
        }

        if (endRank === 7) {
          if (promotion === undefined) {
            throw new Error(
              'Promotion is undefined in a move that should have been a pawn promotion.'
            );
          }

          endPiece.type = promotion;
        }
        break;
      case PieceType.rook:
      case PieceType.knight:
      case PieceType.bishop:
      case PieceType.king:
      case PieceType.queen:
        throw new Error('Unimplemented move');
    }

    if (endPiece !== null) {
      endPiece.moves++;
    }

    this.board[startRank][startFile] = startPiece;
    this.board[endRank][endFile] = endPiece;
  }

  async generateBoardCanvasPNGData(
    perspectiveColor: PieceColor
  ): Promise<Buffer> {
    const FILES = 8;
    const RANKS = 8;

    const SQUARE_WIDTH = 60;
    const SQUARE_HEIGHT = 60;

    const BOARD_HEIGHT = SQUARE_HEIGHT * RANKS;
    const BOARD_WIDTH = SQUARE_WIDTH * FILES;

    const RANK_X_PADDING = 5;
    const RANK_Y_PADDING = 15;

    const FILE_X_PADDING = 10;
    const FILE_Y_PADDING = 5;

    const PIECE_WIDTH = 45;
    const PIECE_HEIGHT = 45;

    const canvas = createCanvas(BOARD_WIDTH, BOARD_HEIGHT);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    for (const [rank, row] of (perspectiveColor === 'white'
      ? [...this.board].reverse()
      : this.board
    ).entries()) {
      for (const [file, piece] of (perspectiveColor === 'black'
        ? [...row].reverse()
        : row
      ).entries()) {
        const isDarkSquare = rank % 2 === file % 2;

        ctx.fillStyle = isDarkSquare ? '#66BB6A' : 'white';

        const squareX = file * SQUARE_WIDTH;
        const squareY = rank * SQUARE_HEIGHT;
        ctx.fillRect(squareX, squareY, SQUARE_WIDTH, SQUARE_HEIGHT);

        ctx.fillStyle = isDarkSquare ? 'white' : '#779952';

        if (file === 0) {
          ctx.fillText(
            (perspectiveColor === 'white' ? RANKS - rank : rank + 1).toString(),
            squareX + RANK_X_PADDING,
            squareY + RANK_Y_PADDING
          );
        }

        if (rank + 1 === RANKS) {
          ctx.fillText(
            String.fromCharCode(
              perspectiveColor === 'white'
                ? file + 'a'.charCodeAt(0)
                : 'h'.charCodeAt(0) - file
            ),
            squareX + SQUARE_WIDTH - FILE_X_PADDING,
            squareY + SQUARE_HEIGHT - FILE_Y_PADDING
          );
        }

        if (piece === null) {
          continue;
        }

        const image = await loadImage(
          `assets/chess-pieces/${piece.color}/${piece.type}.svg`
        );

        ctx.drawImage(
          image,
          squareX + SQUARE_WIDTH / 2 - PIECE_WIDTH / 2,
          squareY + SQUARE_HEIGHT / 2 - PIECE_WIDTH / 2,
          PIECE_WIDTH,
          PIECE_HEIGHT
        );
      }
    }

    return ctx.canvas.toBuffer('image/png');
  }
}
