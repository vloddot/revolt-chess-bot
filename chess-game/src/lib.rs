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

mod helpers {
    use wasm_bindgen::prelude::wasm_bindgen;

    #[wasm_bindgen(module = "/../src/lib/helpers.ts")]
    extern "C" {
        pub fn load_asset(path: String) -> Vec<u8>;
    }
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

/// Represents a singular square of a chessboard.
#[derive(Copy, Clone, Default, Hash, PartialEq, PartialOrd, Eq, Debug)]
#[repr(transparent)]
#[wasm_bindgen]
pub struct SQ(u8);

pub const RANK_COUNT: u8 = 8;
pub const FILE_COUNT: u8 = 8;
pub const SQ_COUNT: u8 = 64;

const SQUARE_WIDTH: u32 = 80;
const SQUARE_HEIGHT: u32 = 80;

const RANK_RIGHT_PADDING: u32 = 30;
const FILE_TOP_PADDING: u32 = 30;

const FILE_EDGE_PADDING: u32 = 30;
const RANK_EDGE_PADDING: u32 = 5;

const IMAGE_WIDTH: u32 = SQUARE_WIDTH * FILE_COUNT as u32 + RANK_RIGHT_PADDING;
const IMAGE_HEIGHT: u32 = SQUARE_HEIGHT * RANK_COUNT as u32 + FILE_TOP_PADDING;

const PIECE_WIDTH: u32 = 60;
const PIECE_HEIGHT: u32 = 60;

pub static SQ_DISPLAY: [&str; SQ_COUNT as usize] = [
    "a1", "b1", "c1", "d1", "e1", "f1", "g1", "h1", "a2", "b2", "c2", "d2", "e2", "f2", "g2", "h2",
    "a3", "b3", "c3", "d3", "e3", "f3", "g3", "h3", "a4", "b4", "c4", "d4", "e4", "f4", "g4", "h4",
    "a5", "b5", "c5", "d5", "e5", "f5", "g5", "h5", "a6", "b6", "c6", "d6", "e6", "f6", "g6", "h6",
    "a7", "b7", "c7", "d7", "e7", "f7", "g7", "h7", "a8", "b8", "c8", "d8", "e8", "f8", "g8", "h8",
];

impl SQ {
    pub const NONE: Self = Self(SQ_COUNT);
}

impl std::fmt::Display for SQ {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(SQ_DISPLAY[self.0 as usize - 8])
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

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
#[wasm_bindgen]
pub enum Player {
    White,
    Black,
}

#[derive(Debug, PartialEq, Eq, Clone, Copy)]
#[wasm_bindgen]
pub enum PieceKind {
    None,
    Pawn,
    Knight,
    Bishop,
    Rook,
    Queen,
    King,
    All,
}

pub enum SquareColor {
    Dark,
    Light,
    Yellow,
}

impl std::fmt::Display for SquareColor {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Dark => "dark",
            Self::Light => "light",
            Self::Yellow => "yellow",
        })
    }
}

impl std::fmt::Display for PieceKind {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Pawn => "pawn",
            Self::Knight => "knight",
            Self::Bishop => "bishop",
            Self::Rook => "rook",
            Self::Queen => "queen",
            Self::King => "king",
            _ => "unknown",
        })
    }
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
#[derive(Debug, Copy, Clone, PartialEq, Eq)]
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
        Ok(match c {
            'P' => Self::new(PieceKind::Pawn, Player::White),
            'p' => Self::new(PieceKind::Pawn, Player::Black),
            'r' => Self::new(PieceKind::Rook, Player::Black),
            'R' => Self::new(PieceKind::Rook, Player::White),
            'n' => Self::new(PieceKind::Knight, Player::Black),
            'N' => Self::new(PieceKind::Knight, Player::White),
            'b' => Self::new(PieceKind::Bishop, Player::Black),
            'B' => Self::new(PieceKind::Bishop, Player::White),
            'q' => Self::new(PieceKind::Queen, Player::Black),
            'Q' => Self::new(PieceKind::Queen, Player::White),
            'k' => Self::new(PieceKind::King, Player::Black),
            'K' => Self::new(PieceKind::King, Player::White),
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
            log(&format!("genuinely invalid move: {uci_move}"));
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
            pleco::PieceType::P => PieceKind::Pawn,
            pleco::PieceType::N => PieceKind::Knight,
            pleco::PieceType::B => PieceKind::Bishop,
            pleco::PieceType::R => PieceKind::Rook,
            pleco::PieceType::Q => PieceKind::Queen,
            pleco::PieceType::K => PieceKind::King,
            pleco::PieceType::None => PieceKind::None,
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
    pub fn generate_board_png(&self, perspective_color: Player) -> Result<Vec<u8>, String> {
        let mut image = Image::new(IMAGE_WIDTH, IMAGE_HEIGHT, Rgba::transparent());

        Self::generate_coordinate_png(&mut image, perspective_color)?;

        let board = self.get_board(perspective_color == Player::Black)?;

        #[allow(clippy::cast_possible_truncation)]
        for (rank, row) in board.iter().enumerate() {
            for (file, piece) in row.iter().enumerate() {
                let (square_x, square_y) = (
                    file as u32 * SQUARE_WIDTH + RANK_RIGHT_PADDING,
                    rank as u32 * SQUARE_HEIGHT,
                );

                #[allow(clippy::cast_possible_truncation)]
                let square_color = self.get_square_color(file as u8, rank as u8, perspective_color);
                for y in square_y..square_y + SQUARE_HEIGHT {
                    for x in square_x..square_x + SQUARE_WIDTH {
                        image.set_pixel(
                            x,
                            y,
                            match square_color {
                                SquareColor::Dark => Rgba::new(118, 150, 82, 255),
                                SquareColor::Light => Rgba::new(238, 238, 210, 255),
                                SquareColor::Yellow => Rgba::new(255, 255, 0, 255),
                            },
                        );
                    }
                }

                if let Some(piece) = piece {
                    let piece_asset = helpers::load_asset(format!(
                        "chess-pieces/{color}/{square_color}/{kind}.png",
                        color = if piece.color == Player::White {
                            "white"
                        } else {
                            "black"
                        },
                        kind = piece.kind
                    ));

                    let piece_image = match Image::<Rgba>::from_reader(
                        ImageFormat::Png,
                        piece_asset.as_slice(),
                    ) {
                        Ok(image) => image,
                        Err(error) => return Err(format!("Could not load piece asset: {error}")),
                    };

                    image.paste(
                        square_x + SQUARE_WIDTH / 2 - PIECE_WIDTH / 2,
                        square_y + SQUARE_HEIGHT / 2 - PIECE_HEIGHT / 2,
                        &piece_image,
                    );
                }
            }
        }

        let mut encoded_image = Vec::new();
        if let Err(error) = image.encode(ImageFormat::Png, &mut encoded_image) {
            return Err(format!("Could not encode image: {error}"));
        }

        Ok(encoded_image)
    }

    fn get_square_color(&self, file: u8, rank: u8, perspective_color: Player) -> SquareColor {
        let is_dark_square = rank % 2 != file % 2;
        let mut square_color = if is_dark_square {
            SquareColor::Dark
        } else {
            SquareColor::Light
        };

        let (display_file, display_rank) = if perspective_color == Player::White {
            ((file + b'a') as char, RANK_COUNT - rank)
        } else {
            ((b'h' - file) as char, rank + 1)
        };

        if let Some(last_move) = self.moves.last() {
            let current_square = display_file.to_string() + &display_rank.to_string();

            if current_square == last_move.start_square.to_string()
                || current_square == last_move.target_square.to_string()
            {
                square_color = SquareColor::Yellow;
            }
        }

        square_color
    }

    fn generate_coordinate_png(
        image: &mut Image<Rgba>,
        perspective_color: Player,
    ) -> Result<(), String> {
        let font = match Font::from_reader(
            helpers::load_asset("fonts/OpenSans.ttf".to_string()).as_slice(),
            20.0,
        ) {
            Ok(font) => font,
            Err(error) => return Err(format!("Could not read font: {error}")),
        };

        for rank in 0..RANK_COUNT {
            image.draw(
                &TextSegment::new(
                    &font,
                    match perspective_color {
                        Player::White => RANK_COUNT - rank,
                        Player::Black => rank + 1,
                    }
                    .to_string(),
                    Rgba::white(),
                )
                .with_position(
                    RANK_EDGE_PADDING,
                    u32::from(rank) * SQUARE_HEIGHT + SQUARE_HEIGHT / 2,
                ),
            );
        }

        for file in 0..FILE_COUNT {
            image.draw(
                &TextSegment::new(
                    &font,
                    String::from_utf8_lossy(&[match perspective_color {
                        Player::White => file + b'a',
                        Player::Black => b'h' - file,
                    }]),
                    Rgba::white(),
                )
                .with_position(
                    u32::from(file) * SQUARE_HEIGHT + SQUARE_HEIGHT / 2 + RANK_RIGHT_PADDING,
                    IMAGE_HEIGHT - FILE_EDGE_PADDING,
                ),
            );
        }

        Ok(())
    }

    fn get_board(&self, reversed: bool) -> Result<[[Option<Piece>; 8]; 8], String> {
        let mut board = [[Option::<Piece>::None; 8]; 8];
        let mut i = 0;
        let mut j = 0;

        let mut fen: Vec<char> = self.fen().chars().collect();

        if reversed {
            let Some(fen) = fen.split_mut(|c| *c == ' ').next() else {
                return Err("Invalid FEN string".to_string());
            };

            fen.reverse();
        }

        for c in fen {
            if i >= 7 && c == ' ' {
                break;
            }

            if c == '/' {
                i += 1;
                j = 0;
                continue;
            }

            match c.to_string().parse::<usize>() {
                Ok(n @ 1..=8) => {
                    board[i][j..j + n].fill(None);
                    j += n;
                }
                Err(_) => {
                    board[i][j] = Some(Piece::from_fen(c)?);
                    j += 1;
                }
                Ok(n) => return Err(format!("Invalid amount of empty spaces: {n}")),
            }
        }

        Ok(board)
    }
}

impl Default for ChessGame {
    fn default() -> Self {
        Self::new()
    }
}
