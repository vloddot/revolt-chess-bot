#![warn(
    clippy::all,
    clippy::pedantic,
    clippy::style,
    clippy::nursery,
    clippy::unwrap_used,
    clippy::expect_used
)]

mod utils;

use pleco::{Board, SQ};
use wasm_bindgen::prelude::wasm_bindgen;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

/// A game of chess.
#[wasm_bindgen]
pub struct ChessGame {
    board: Board,
}

/// Wrapper for `SQ` to be WASM serializable.
#[wasm_bindgen]
pub struct Square(SQ);

/// All possible Types of Pieces on a chessboard, for both colors.
///
/// For a representation of Only Pieces (with no color attached), see [`PieceType`]
///
/// [`Piece`]: ./enum.PieceType
#[wasm_bindgen]
#[repr(u8)]
#[derive(Copy, Clone, PartialEq, Eq)]
pub enum Piece {
    None,
    WhitePawn,
    WhiteKnight,
    WhiteBishop,
    WhiteRook,
    WhiteQueen,
    WhiteKing,
    BlackPawn,
    BlackKnight,
    BlackBishop,
    BlackRook,
    BlackQueen,
    BlackKing,
}

pub enum MoveResult {
    ValidMove,
    InvalidMove,
    Check,
    Checkmate,
}

#[wasm_bindgen]
impl ChessGame {
    #[must_use]
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            board: Board::start_pos(),
        }
    }

    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn fen(&self) -> String {
        self.board.fen()
    }

    /// Apply a move to the board by using the `uci_move`.
    ///
    /// # Returns
    ///
    /// This function will return `true` if the move is valid, `false` otherwise.
    ///
    /// # Examples
    /// ```
    /// const game = new ChessGame();
    /// game.apply_move("e2e4") === true; // move is applied, pretty good move, uses a notation where the src and dst squares are specified
    /// game.apply_move("e7e8q") === false; // move cannot be applied when the board is at the starting position, this adds a new character for the promotion of the pawn moving from e7 to e8
    /// ```
    #[wasm_bindgen]
    pub fn apply_move(&mut self, uci_move: &str) -> bool {
        self.board.apply_uci_move(uci_move)
    }
}

impl Default for ChessGame {
    fn default() -> Self {
        Self::new()
    }
}
