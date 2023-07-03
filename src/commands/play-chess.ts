import os from 'os';
import { Channel, Client, Message } from 'revolt.js';
import { prompt, promptYesOrNo, uploadToAutumn } from '$lib/helpers';
import ChessGame, { PieceColor, PieceType } from '$lib/ChessGame';
import { Engine } from 'node-uci';
import { MoveResult } from 'chess-game/pkg/chess_game';

export default async function playChessCommand(client: Client, message: Message, args: string[]) {
  const originalMessageID = message._id;
  const player1ID = message.author_id;
  const channel = message.channel;
  let player2ID: string | undefined;

  function getColor(response: string): PieceColor | undefined {
    switch (response.toLowerCase()) {
      case 'white':
        return 'white';
      case 'black':
        return 'black';
      case 'random':
        return Math.random() > 0.5 ? 'white' : 'black';
      default:
        return undefined;
    }
  }

  if (args.length > 3) {
    await channel?.sendMessage({
      content: `Expected at most 2 arguments. Found ${args.length - 1}
      Usage: /play-chess [color] [other-player]`,
      replies: [{ id: message._id, mention: false }],
    });
    return;
  }

  async function promptColor(): Promise<PieceColor> {
    while (true) {
      const message = await prompt(client, channel, player1ID, {
        content: 'What color do you want to play as? Expect either "White", "Black", or "Random".',
        replies: [{ id: originalMessageID, mention: false }],
      });

      if (message.content === null) {
        await channel?.sendMessage({
          content: 'Expected message content.',
          replies: [{ id: message._id, mention: false }],
        });
        continue;
      }

      const color = getColor(message.content);
      if (color !== undefined) {
        return color;
      }

      await channel?.sendMessage({
        content: 'Invalid color, expected either "White", "Black", or "Random".',
        replies: [{ id: message._id, mention: false }],
      });
    }
  }

  let player1Color: PieceColor = 'white';

  if (args.length >= 2) {
    const response = getColor(args[1]);

    if (response === undefined) {
      player1Color = await promptColor();
    } else {
      player1Color = response;
    }
  } else {
    player1Color = await promptColor();
  }

  if (message.mention_ids === null) {
    while (player2ID === undefined) {
      while (true) {
        const message = await prompt(client, channel, player1ID, {
          content: 'Who do you want to play against?',
          replies: [{ id: originalMessageID, mention: false }],
        });

        if (
          message.mention_ids === null ||
          message.mention_ids.length !== 1 ||
          message.mention_ids[0] === player1ID
        ) {
          await channel?.sendMessage({
            content: 'Expected one mention to another user.',
            replies: [{ id: message._id, mention: false }],
          });
          continue;
        }

        player2ID = message.mention_ids[0];
        break;
      }
    }
  } else if (message.mention_ids.length !== 1) {
    await channel?.sendMessage({
      content: 'Expected only one person to play against.',
      replies: [{ id: message._id, mention: false }],
    });
    return;
  } else {
    player2ID = message.mention_ids[0];
  }

  const stockfishOptions: StockfishOptions = {
    Threads: os.cpus().length.toString(),
    // eslint-disable-next-line camelcase
    UCI_Chess960: 'false',
    // eslint-disable-next-line camelcase
    UCI_Elo: '150',
    Hash: '16',
    // eslint-disable-next-line camelcase
    UCI_LimitStrength: 'true',
    MultiPV: '1',
    Ponder: 'true',
    'Skill Level': '20',
    'Slow Mover': '100',
    'Use NNUE': 'true',
  };

  if (player2ID === client.user?._id) {
    await promptYesOrNo(
      async (yes) => {
        if (!yes) {
          return;
        }

        for (const [key, value] of Object.entries(stockfishOptions)) {
          while (true) {
            const message = await prompt(
              client,
              channel,
              player1ID,
              `What is the value for "${key}"? the default value is ${value}. Type "-1" to use the default value.`
            );

            if (message.content === null) {
              await channel?.sendMessage(`Expected message content.`);
              continue;
            }

            if (message.content !== '-1') {
              stockfishOptions[key as keyof StockfishOptions] = message.content;
            }

            break;
          }
        }
      },
      client,
      channel,
      player1ID,
      {
        content:
          'Do you want to configure the game against the bot? I use the same settings as Stockfish.',
        replies: [{ id: message._id, mention: false }],
      }
    );
    await playChessGame(client, player1ID, player2ID, player1Color, channel, stockfishOptions);
    return;
  }

  await promptYesOrNo(
    async (yes) => {
      if (!yes) {
        await channel?.sendMessage('Aborting chess game.');
        return;
      }

      if (player2ID === undefined) {
        throw new Error('Player 2 ID is undefined. Unreachable.');
      }

      await playChessGame(client, player1ID, player2ID, player1Color, channel);
    },
    client,
    channel,
    player2ID,
    `Do you want to play against <@${player1ID}>, <@${player2ID}>?`
  );
}

async function playChessGame(
  client: Client,
  player1ID: string,
  player2ID: string,
  player1Color: PieceColor,
  channel?: Channel,
  stockfishOptions?: StockfishOptions
) {
  let engine: Engine | undefined;

  const player2Color: PieceColor = player1Color === 'white' ? 'black' : 'white';

  if (stockfishOptions !== undefined) {
    if (player2ID === client.user?._id) {
      engine = new Engine('stockfish');

      await engine.init();
      await engine.setoption('Threads', stockfishOptions.Threads);
      await engine.setoption('Hash', stockfishOptions.Hash);
      await engine.setoption('Ponder', stockfishOptions.Ponder);
      await engine.setoption('MultiPV', stockfishOptions.MultiPV);
      await engine.setoption('Use NNUE', stockfishOptions['Use NNUE']);
      await engine.setoption('UCI_Chess960', stockfishOptions.UCI_Chess960);
      await engine.setoption('UCI_LimitStrength', stockfishOptions.UCI_LimitStrength);
      await engine.setoption('UCI_Elo', stockfishOptions.UCI_Elo);
      await engine.setoption('Skill Level', stockfishOptions['Skill Level']);
      await engine.setoption('Slow Mover', stockfishOptions['Slow Mover']);
      await engine.isready();
    }
  }

  await channel?.sendMessage(
    `Starting chess game between <@${player1ID}> (${player1Color}) and <@${player2ID}> (${player2Color})`
  );

  const chessGame = new ChessGame();

  let currentTurn = player1Color === 'white' ? 1 : 2;

  mainLoop: while (true) {
    const playerID = currentTurn === 1 ? player1ID : player2ID;

    const png = await chessGame.generateBoardPNG(currentTurn === 1 ? player1Color : player2Color);

    const move =
      engine !== undefined && currentTurn === 2
        ? await generateBestMove(engine)
        : await promptChessMove({
            client,
            channel,
            png,
            playerID,
          });

    if (move === null) {
      break;
    }

    const [start, end] = [move.slice(0, 2), move.slice(2, 4)];

    let promotion: PieceType | undefined;
    if (move.length === 5) {
      const promotionMapping = {
        r: PieceType.rook,
        b: PieceType.bishop,
        n: PieceType.knight,
        q: PieceType.queen,
      };

      promotion = promotionMapping[move[4].toLowerCase() as keyof typeof promotionMapping];
    }

    const result = chessGame.applyMove(start, end, promotion);

    switch (result) {
      case MoveResult.InvalidMove:
        await channel?.sendMessage('This is an invalid move.');
        continue mainLoop;
      case MoveResult.Checkmate:
        await channel?.sendMessage(`Win by checkmate for <@${playerID}>`);
        break mainLoop;
      case MoveResult.Stalemate:
        await channel?.sendMessage('Draw in stalemate.');
        break mainLoop;
      case MoveResult.Check:
        await channel?.sendMessage('Check!');
        break;
    }

    currentTurn = currentTurn === 1 ? 2 : 1;
  }
}

interface StockfishOptions {
  Threads: string;
  Hash: string;
  Ponder: string;
  MultiPV: string;
  'Use NNUE': string;
  UCI_Chess960: string;
  UCI_LimitStrength: string;
  UCI_Elo: string;
  'Skill Level': string;
  'Slow Mover': string;
}

async function promptChessMove({
  client,
  png,
  channel,
  playerID,
}: {
  client: Client;
  png: Buffer;
  channel: Channel | undefined;
  playerID: string;
}): Promise<string | null> {
  const attachment = await uploadToAutumn(client, png, 'chess.png', 'image/png');

  while (true) {
    const message = await prompt(client, channel, playerID, {
      content: `It's your turn, <@${playerID}>.`,
      attachments: [attachment],
    });

    const content = message.content?.trim();

    const matches = content?.match(/\b([a-h][1-8]){2}\b/gi);

    if (content?.match(/\b(abort|resign)\b/gi)) {
      await channel?.sendMessage('Aborting chess game.');
      return null;
    }

    if (content === undefined || !matches) {
      await channel?.sendMessage({
        content: `You must send a message in [Pure Algebraic Coordinate Notation](<https://www.chessprogramming.org/Algebraic_Chess_Notation#Pure_coordinate_notation>), meaning put the starting square first, then the ending square.
                    Like this: e2e4. Even castling is put in as something like e1g1 instead of O-O or O-O-O.
                    Some other examples:
                      g1f3,
                      e7e8q (pawn promotion, can use any of "q", "r", "b", or "n" to determine what the pawn is promoting to).`,
        replies: [{ id: message._id, mention: false }],
      });
      continue;
    }

    return matches[0];
  }
}

async function generateBestMove(engine: Engine): Promise<string> {
  const { bestmove } = await engine.go({ depth: 15 });
  return bestmove;
}
