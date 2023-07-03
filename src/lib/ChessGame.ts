import { createCanvas, loadImage } from 'canvas';
import { MoveResult, ChessGame as WASMChessGame } from '../../chess-game/pkg/chess_game';

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
  missedEnPassant: boolean | undefined;

  constructor(type: PieceType, color: PieceColor) {
    this.type = type;
    this.color = color;
    this.moves = 0;

    if (type === PieceType.pawn) {
      this.missedEnPassant = false;
    }
  }

  static fromFen(c: string): Piece {
    switch (c) {
      case 'p':
      case 'P':
        return new this(PieceType.pawn, c === 'P' ? 'white' : 'black');
      case 'r':
      case 'R':
        return new this(PieceType.rook, c === 'R' ? 'white' : 'black');
      case 'n':
      case 'N':
        return new this(PieceType.knight, c === 'N' ? 'white' : 'black');
      case 'b':
      case 'B':
        return new this(PieceType.bishop, c === 'B' ? 'white' : 'black');
      case 'q':
      case 'Q':
        return new this(PieceType.queen, c === 'Q' ? 'white' : 'black');
      case 'k':
      case 'K':
        return new this(PieceType.king, c === 'K' ? 'white' : 'black');
      default:
        throw new Error('Invalid FEN character');
    }
  }
}

export default class ChessGame {
  private inner: WASMChessGame;
  private lastMove: string | null;

  constructor() {
    this.inner = new WASMChessGame();
    this.lastMove = null;
  }

  get fen(): string {
    return this.inner.fen;
  }

  get board(): Piece[][] {
    const board: Piece[][] = [[], [], [], [], [], [], [], []];
    let i = 0;

    const fen = this.inner.fen;
    for (const c of fen) {
      if (i >= 7 && c === ' ') {
        break;
      }

      if (c === '/') {
        i++;
        continue;
      }

      const number = Number(c);

      if (!Number.isNaN(number)) {
        if (c === '9') {
          throw new Error('Invalid amount of empty spaces.');
        }

        board[i].push(...Array(number).fill(null));
      } else {
        board[i].push(Piece.fromFen(c));
      }
    }

    return board;
  }

  applyMove(start: string, target: string, promotion?: string): MoveResult {
    let move = start + target;
    if (promotion !== undefined) {
      move += promotion;
    }

    const result = this.inner.apply_move(move);

    if (result === MoveResult.InvalidMove) {
      this.lastMove = move;
    }

    return result;
  }

  async generateBoardPNG(perspectiveColor: PieceColor): Promise<Buffer> {
    const FILES = 8;
    const RANKS = 8;

    const SQUARE_WIDTH = 60;
    const SQUARE_HEIGHT = 60;

    const RANK_X_PADDING = 30;
    const FILE_Y_PADDING = 30;

    const COORDINATE_BOTTOM_PADDING = 5;

    const BOARD_HEIGHT = SQUARE_HEIGHT * RANKS + FILE_Y_PADDING;
    const BOARD_WIDTH = SQUARE_WIDTH * FILES + RANK_X_PADDING;

    const PIECE_WIDTH = 45;
    const PIECE_HEIGHT = 45;

    const canvas = createCanvas(BOARD_WIDTH, BOARD_HEIGHT);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'white';
    ctx.font = '20px sans-serif';

    for (let rank = 0; rank < RANKS; rank++) {
      ctx.fillText(
        (perspectiveColor === 'white' ? RANKS - rank : rank + 1).toString(),
        COORDINATE_BOTTOM_PADDING,
        rank * SQUARE_HEIGHT + SQUARE_HEIGHT / 2
      );
    }

    for (let file = 0; file < FILES; file++) {
      ctx.fillText(
        String.fromCharCode(
          perspectiveColor === 'white' ? file + 'a'.charCodeAt(0) : 'h'.charCodeAt(0) - file
        ),
        file * SQUARE_WIDTH + SQUARE_WIDTH / 2 + RANK_X_PADDING,
        BOARD_HEIGHT - COORDINATE_BOTTOM_PADDING
      );
    }

    const board = perspectiveColor === 'white' ? this.board : [...this.board].reverse();

    for (const [rankIndex, row] of board.entries()) {
      const currentRow = perspectiveColor === 'black' ? [...row].reverse() : row;

      for (const [fileIndex, piece] of currentRow.entries()) {
        const displayFile = String.fromCharCode(
          perspectiveColor === 'white'
            ? fileIndex + 'a'.charCodeAt(0)
            : 'h'.charCodeAt(0) - fileIndex
        );

        const displayRank = perspectiveColor === 'white' ? RANKS - rankIndex : rankIndex + 1;

        const isDarkSquare = rankIndex % 2 !== fileIndex % 2;

        const [start, end] = [this.lastMove?.slice(0, 2), this.lastMove?.slice(2, 4)];

        const currentSquare = displayFile + displayRank.toString();

        if (start === currentSquare || end === currentSquare) {
          ctx.fillStyle = 'yellow';
        } else {
          ctx.fillStyle = isDarkSquare ? '#769652' : '#EEEED2';
        }

        const squareX = fileIndex * SQUARE_WIDTH + RANK_X_PADDING;
        const squareY = rankIndex * SQUARE_HEIGHT;
        ctx.fillRect(squareX, squareY, SQUARE_WIDTH, SQUARE_HEIGHT);

        ctx.fillStyle = isDarkSquare ? 'white' : '#779952';

        if (piece === null) {
          continue;
        }

        const image = await loadImage(`assets/chess-pieces/${piece.color}/${piece.type}.svg`);

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
