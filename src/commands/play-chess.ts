import os from 'os';
import { Channel, Client, Message } from 'revolt.js';
import { prompt, promptYesOrNo, uploadToAutumn } from '$lib/helpers';
import { Engine } from 'node-uci';
import { MoveResult, ChessGame, Player, SQ } from 'chess-game/pkg/chess_game';

export default async function playChessCommand(
  client: Client,
  message: Message,
  args: string[]
): Promise<void> {
  const originalMessageID = message._id;
  const player1ID = message.author_id;
  const channel = message.channel;
  let player2ID: string | undefined;

  function getColor(response: string): Player | undefined {
    switch (response.toLowerCase()) {
      case 'white':
        return Player.White;
      case 'black':
        return Player.Black;
      case 'random':
        return Math.random() > 0.5 ? Player.White : Player.Black;
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

  async function promptColor(): Promise<Player> {
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

  let player1Color: Player = Player.White;

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

  if (player2ID === client.user?._id) {
    const stockfishOptions: StockfishOptions = {
      Threads: os.cpus().length.toString(),
      UCI_Elo: '150',
      Hash: '16',
      UCI_LimitStrength: 'true',
      MultiPV: '1',
      Ponder: 'true',
      'Skill Level': '20',
      'Slow Mover': '100',
      'Use NNUE': 'true',
    };

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
  player1Color: Player,
  channel?: Channel,
  stockfishOptions?: StockfishOptions
): Promise<void> {
  let engine: Engine | undefined;

  const player2Color: Player = player1Color === Player.White ? Player.Black : Player.White;

  if (stockfishOptions !== undefined) {
    if (player2ID === client.user?._id) {
      engine = new Engine('stockfish');

      await engine.init();
      await engine.setoption('Threads', stockfishOptions.Threads);
      await engine.setoption('Hash', stockfishOptions.Hash);
      await engine.setoption('Ponder', stockfishOptions.Ponder);
      await engine.setoption('MultiPV', stockfishOptions.MultiPV);
      await engine.setoption('Use NNUE', stockfishOptions['Use NNUE']);
      await engine.setoption('UCI_LimitStrength', stockfishOptions.UCI_LimitStrength);
      await engine.setoption('UCI_Elo', stockfishOptions.UCI_Elo);
      await engine.setoption('Skill Level', stockfishOptions['Skill Level']);
      await engine.setoption('Slow Mover', stockfishOptions['Slow Mover']);
      await engine.isready();
    }
  }

  await channel?.sendMessage(
    `Starting chess game between <@${player1ID}> (${player1Color === Player.White ? 'white' : 'black'}) and <@${player2ID}> (${player2Color === Player.White ? 'white' : 'black'})`
  );

  const chessGame = new ChessGame();

  let currentTurn = player1Color === Player.White ? 1 : 2;

  mainLoop: while (true) {
    const playerID = currentTurn === 1 ? player1ID : player2ID;

    const png = chessGame.generateBoardPNG(currentTurn === 1 ? player1Color : player2Color);

    const move =
      engine !== undefined && currentTurn === 2
        ? await generateBestMove(engine, channel)
        : await promptChessMove({
            client,
            channel,
            png,
            playerID,
          });

    if (move === null) {
      break;
    }

    const [start, target] = [move.slice(0, 2), move.slice(2, 4)];

    const result = chessGame.applyMove(new SQ(start[0], Number(start[1])), new SQ(target[0], Number(target[1])), move[4]);

    switch (result) {
      case MoveResult.Invalid:
        await channel?.sendMessage('This is an invalid move.');
        continue mainLoop;
      case MoveResult.Checkmate:
        await channel?.sendMessage(`Win by checkmate for <@${playerID}>!`);
        break mainLoop;
      case MoveResult.Check:
        await channel?.sendMessage('Check!');
        break;
      case MoveResult.Stalemate:
        await channel?.sendMessage('Draw in stalemate.');
        break mainLoop;
    }

    if (engine !== undefined) {
      engine.position(chessGame.fen);
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
  png: Uint8Array;
  channel: Channel | undefined;
  playerID: string;
}): Promise<string | null> {
  const attachment = await uploadToAutumn(client, png, 'chess.png', 'image/png');
  await channel?.sendMessage({
    content: `It's your turn, <@${playerID}>.`,
    attachments: [attachment],
  });

  while (true) {
    const message = await prompt(client, channel, playerID);

    const content = message.content?.trim();

    if (content?.match(/\b(abort|resign)\b/gi)) {
      await channel?.sendMessage('Aborting chess game.');
      return null;
    }

    const args = content?.split(' ');

    if (args?.[0] !== '/move') {
      continue;
    }

    const move = args?.[1];

    const matches = move?.match(/([a-h][1-8]){2}/);

    if (matches === null || matches.length === 0) {
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

async function generateBestMove(engine: Engine, channel?: Channel): Promise<string> {
  const { bestmove } = await engine.go({ depth: 15 });
  await channel?.sendMessage(`I will play... ${bestmove}!`);
  return bestmove;
}
