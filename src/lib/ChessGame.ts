import { createCanvas, loadImage } from 'canvas';
import { ChessGame as WASMChessGame } from '../../chess-game/pkg/chess_game';

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

  constructor() {
    this.inner = new WASMChessGame();
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

  applyMove(start: string, target: string, promotion?: string): boolean {
    let move = start + target;
    if (promotion !== undefined) {
      move += promotion;
    }

    return this.inner.apply_move(move);
  }

  async generateBoardPNG(perspectiveColor: PieceColor): Promise<Buffer> {
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

    const board = perspectiveColor === 'white' ? this.board : [...this.board].reverse();

    for (const [rankIndex, row] of board.entries()) {
      const currentRow = perspectiveColor === 'black' ? [...row].reverse() : row;

      for (const [fileIndex, piece] of currentRow.entries()) {
        const isDarkSquare = rankIndex % 2 !== fileIndex % 2;

        ctx.fillStyle = isDarkSquare ? '#769652' : '#EEEED2';

        const squareX = fileIndex * SQUARE_WIDTH;
        const squareY = rankIndex * SQUARE_HEIGHT;
        ctx.fillRect(squareX, squareY, SQUARE_WIDTH, SQUARE_HEIGHT);

        ctx.fillStyle = isDarkSquare ? 'white' : '#779952';

        if (fileIndex === 0) {
          ctx.fillText(
            (perspectiveColor === 'white' ? RANKS - rankIndex : rankIndex + 1).toString(),
            squareX + RANK_X_PADDING,
            squareY + RANK_Y_PADDING
          );
        }

        if (rankIndex + 1 === RANKS) {
          ctx.fillText(
            String.fromCharCode(
              perspectiveColor === 'white'
                ? fileIndex + 'a'.charCodeAt(0)
                : 'h'.charCodeAt(0) - fileIndex
            ),
            squareX + SQUARE_WIDTH - FILE_X_PADDING,
            squareY + SQUARE_HEIGHT - FILE_Y_PADDING
          );
        }

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
