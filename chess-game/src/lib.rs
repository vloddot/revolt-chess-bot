#![warn(
    clippy::all,
    clippy::pedantic,
    clippy::style,
    clippy::nursery,
    clippy::unwrap_used,
    clippy::expect_used
)]

mod utils;

use ril::{Font, Image, ImageFormat, Rgba, TextSegment};
use wasm_bindgen::prelude::wasm_bindgen;

// When the `wee_alloc` feature is enabled, use `wee_alloc` as the global
// allocator.
#[cfg(feature = "wee_alloc")]
#[global_allocator]
static ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

mod console {
    use wasm_bindgen::prelude::wasm_bindgen;

    #[wasm_bindgen]
    extern "C" {
        #[wasm_bindgen(js_namespace = console)]
        pub fn log(s: &str);
    }
}

/// Represents a singular square of a chessboard.
#[derive(Copy, Clone, Default, Hash, PartialEq, PartialOrd, Eq, Debug)]
#[repr(transparent)]
#[wasm_bindgen]
pub struct SQ(u8);

pub const SQ_CNT: usize = 64;

pub static SQ_DISPLAY: [&str; SQ_CNT] = [
    "a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1", "a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2",
    "a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3", "a4", "b4", "c4", "d4", "e4", "f4", "g4", "h4",
    "a5", "b5", "c5", "d5", "e5", "f5", "g5", "h5", "a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6",
    "a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7", "a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8",
];

impl SQ {
    pub const NONE: Self = Self(64);
}

impl std::fmt::Display for SQ {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(SQ_DISPLAY[self.0 as usize])
    }
}

#[wasm_bindgen]
impl SQ {
    #[must_use]
    #[wasm_bindgen(constructor)]
    #[allow(clippy::missing_const_for_fn)]
    pub fn new(file: char, rank: u8) -> Self {
        Self(file as u8 - b'a' + rank * 8)
    }
}

#[derive(PartialEq, Eq)]
#[wasm_bindgen]
pub struct Move {
    start_square: SQ,
    target_square: SQ,
    piece: (Player, PieceKind),
    castling: bool,
    en_passant: bool,
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[wasm_bindgen]
pub enum Player {
    White,
    Black,
}

#[derive(PartialEq, Eq, Clone, Copy)]
#[wasm_bindgen]
pub enum PieceKind {
    None,
    P,
    N,
    B,
    R,
    Q,
    K,
    All,
}

/// A game of chess.
#[wasm_bindgen]
pub struct ChessGame {
    board: pleco::Board,
    moves: Vec<Move>,
}

/// All possible Types of Pieces on a chessboard, for both colors.
///
/// For a representation of Only Pieces (with no color attached), see [`PieceType`]
///
/// [`Piece`]: ./enum.PieceType
#[wasm_bindgen]
#[derive(Copy, Clone, PartialEq, Eq)]
pub struct Piece {
    kind: PieceKind,
    color: Player,
}

#[wasm_bindgen]
impl Piece {
    #[must_use]
    #[allow(clippy::missing_const_for_fn)]
    #[wasm_bindgen(constructor)]
    pub fn new(kind: PieceKind, color: Player) -> Self {
        Self { kind, color }
    }

    /// Generates a piece from the FEN notation character.
    ///
    /// # Errors
    ///
    /// This function will return an error if the FEN character is invalid.
    #[allow(clippy::use_self)]
    #[wasm_bindgen]
    pub fn from_fen(c: char) -> Result<Piece, String> {
        Ok(match c.to_ascii_lowercase() {
            'P' => Self::new(PieceKind::P, Player::White),
            'p' => Self::new(PieceKind::P, Player::Black),
            'r' => Self::new(PieceKind::R, Player::Black),
            'R' => Self::new(PieceKind::R, Player::White),
            'n' => Self::new(PieceKind::N, Player::Black),
            'N' => Self::new(PieceKind::N, Player::White),
            'b' => Self::new(PieceKind::B, Player::Black),
            'B' => Self::new(PieceKind::B, Player::White),
            'q' => Self::new(PieceKind::Q, Player::Black),
            'Q' => Self::new(PieceKind::Q, Player::White),
            'k' => Self::new(PieceKind::K, Player::Black),
            'K' => Self::new(PieceKind::K, Player::White),
            _ => return Err(format!("Invalid fen character: {c}")),
        })
    }
}

#[wasm_bindgen]
pub enum MoveResult {
    Valid,
    Invalid,
    Check,
    Checkmate,
    Stalemate,
    RepetitionBy3Moves,
}

#[wasm_bindgen]
impl ChessGame {
    #[must_use]
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {
            board: pleco::Board::start_pos(),
            moves: Vec::new(),
        }
    }

    #[must_use]
    #[wasm_bindgen(getter)]
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
    #[wasm_bindgen(js_name = "applyMove")]
    pub fn apply_move(
        &mut self,
        start_square: SQ,
        target_square: SQ,
        promotion: Option<String>,
    ) -> MoveResult {
        let uci_move =
            start_square.to_string() + &target_square.to_string() + &promotion.unwrap_or_default();

        if !self.board.apply_uci_move(&uci_move) {
            return MoveResult::Invalid;
        }

        let (pleco_player, piece_type) = self
            .board
            .piece_at_sq(pleco::core::sq::SQ(target_square.0))
            .player_piece_lossy();

        let player = match pleco_player {
            pleco::Player::White => Player::White,
            pleco::Player::Black => Player::Black,
        };

        let piece_type = match piece_type {
            pleco::PieceType::None => PieceKind::None,
            pleco::PieceType::P => PieceKind::P,
            pleco::PieceType::N => PieceKind::N,
            pleco::PieceType::B => PieceKind::B,
            pleco::PieceType::R => PieceKind::R,
            pleco::PieceType::Q => PieceKind::Q,
            pleco::PieceType::K => PieceKind::K,
            pleco::PieceType::All => PieceKind::All,
        };

        let last_move = Move {
            start_square,
            target_square,
            castling: self
                .board
                .can_castle(pleco_player, pleco::core::CastleType::KingSide)
                || self
                    .board
                    .can_castle(pleco_player, pleco::core::CastleType::QueenSide),
            en_passant: self.board.ep_square().0 != SQ::NONE.0,
            piece: (player, piece_type),
        };

        let result = if self.board.checkmate() {
            MoveResult::Checkmate
        } else if self
            .moves
            .iter()
            .filter(|move1| **move1 == last_move)
            .count()
            >= 2
        {
            MoveResult::RepetitionBy3Moves
        } else if self.board.in_check() {
            MoveResult::Check
        } else if self.board.stalemate() {
            MoveResult::Stalemate
        } else {
            MoveResult::Valid
        };

        self.moves.push(last_move);

        result
    }

    /// Generates a PNG representation of the board.
    ///
    /// # Errors
    ///
    /// This function will return an error if the font couldn't be read or the image couldn't be encoded.
    #[wasm_bindgen(js_name = "generateBoardPNG")]
    pub fn generate_board_png(
        &self,
        perspective_color: Player,
        font: &[u8],
    ) -> Result<Vec<u8>, String> {
        const FILES: u8 = 8;
        const RANKS: u8 = 8;

        const SQUARE_WIDTH: u32 = 60;
        const SQUARE_HEIGHT: u32 = 60;

        const RANK_X_PADDING: u32 = 30;
        const FILE_Y_PADDING: u32 = 30;

        const COORDINATE_EDGE_PADDING: u32 = 5;

        const BOARD_HEIGHT: u32 = SQUARE_HEIGHT * RANKS as u32 + FILE_Y_PADDING;
        const BOARD_WIDTH: u32 = SQUARE_WIDTH * FILES as u32 + RANK_X_PADDING;

        const PIECE_WIDTH: u32 = 45;
        const PIECE_HEIGHT: u32 = 45;

        let mut image = Image::new(BOARD_WIDTH, BOARD_HEIGHT, Rgba::transparent());

        let font = match Font::from_reader(font, 20.0) {
            Ok(font) => font,
            Err(error) => return Err(format!("Could not read font: {error}")),
        };

        console::log(&format!("canvas size: ({BOARD_WIDTH}, {BOARD_HEIGHT})"));

        for rank in 0..RANKS {
            let x = COORDINATE_EDGE_PADDING;
            let y = u32::from(rank) * SQUARE_HEIGHT + SQUARE_HEIGHT / 2;
            let text = match perspective_color {
                Player::White => RANKS - rank,
                Player::Black => rank + 1,
            }
            .to_string();

            console::log(&format!("drawing {text:?} at ({x}, {y})"));

            image.draw(&TextSegment::new(&font, text, Rgba::white()).with_position(x, y));
        }

        for file in 0..FILES {
            let x = u32::from(file) * SQUARE_WIDTH + SQUARE_WIDTH / 2 + RANK_X_PADDING;
            let y = BOARD_HEIGHT - COORDINATE_EDGE_PADDING;
            let file_bytes = &[match perspective_color {
                Player::White => file + b'a',
                Player::Black => b'h' - file,
            }];

            let text = String::from_utf8_lossy(file_bytes).to_string();

            console::log(&format!(
                "drawing {text:?} ({}) at ({x}, {y})",
                file_bytes[0]
            ));
            image.draw(&TextSegment::new(&font, text, Rgba::white()).with_position(x, y));
        }

        let mut encoded_image = Vec::new();
        if let Err(error) = image.encode(ImageFormat::Png, &mut encoded_image) {
            return Err(format!("Could not encode image: {error}"));
        }

        Ok(encoded_image)
    }
}

impl Default for ChessGame {
    fn default() -> Self {
        Self::new()
    }
}
