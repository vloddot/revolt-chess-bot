import os from 'os';
import { Channel, Client, Message } from 'revolt.js';
import { prompt, promptYesOrNo, uploadToAutumn } from '$lib/helpers';
import ChessGame, { PieceColor, PieceType } from '$lib/ChessGame';
import { Engine } from 'node-uci';

export async function playChessCommand(client: Client, message: Message, args: string[]) {
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
        return;
      }

      player2ID = message.mention_ids[0];
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
    UCIChess960: 'false',
    UCIElo: '150',
    Hash: '16',
    UCILimitStrength: 'true',
    MultiPV: '1',
    Ponder: 'true',
    SkillLevel: '20',
    SlowMover: '100',
    UseNNUE: 'true',
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
    await startStockfishChessGame(client, player1ID, player1Color, channel, stockfishOptions);
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

      await startChessGame(client, player1ID, player2ID, player1Color, channel);
    },
    client,
    channel,
    player1ID,
    `Do you want to play against <@${player1ID}>, <@${player2ID}>?`
  );
}

async function startChessGame(
  client: Client,
  player1ID: string,
  player2ID: string,
  player1Color: PieceColor,
  channel?: Channel
) {
  const player2Color = player1Color === 'white' ? 'black' : 'white';

  await channel?.sendMessage(
    `Starting chess game between <@${player1ID}> (${player1Color}) and <@${player2ID}> (${player2Color})`
  );

  const chessGame = new ChessGame();

  let currentTurn = player1Color === 'white' ? 1 : 2;

  while (true) {
    const playerID = currentTurn === 1 ? player1ID : player2ID;

    const png = await chessGame.generateBoardPNG(currentTurn === 1 ? player1Color : player2Color);

    const attachment = await uploadToAutumn(client, png, 'chess.png', 'image/png');

    const message = await prompt(client, channel, playerID, {
      content: `It's your turn, <@${playerID}>.`,
      attachments: [attachment],
    });

    if (message.content === null) {
      await channel?.sendMessage({
        content: `You must send a message in Pure Coordinate notation, meaning put the starting square first, then the ending square.
        Like this: e2e4. Even castling is put in as something like e1g1 instead of O-O or O-O-O.
        Some other examples:
          g1f3,
          g4h4q (pawn promotion, can use any of "q", "r", "b", or "n" to determine what the pawn is promoting to).`,
        replies: [{ id: message._id, mention: false }],
      });
      continue;
    }

    const [start, end] = [message.content.slice(0, 2), message.content.slice(2, 4)];

    let promotion: PieceType | undefined;
    if (message.content.length === 5) {
      const promotionMapping = {
        r: PieceType.rook,
        b: PieceType.bishop,
        n: PieceType.knight,
        q: PieceType.queen,
      };

      promotion =
        promotionMapping[message.content[4].toLowerCase() as keyof typeof promotionMapping];
    }

    if (!chessGame.applyMove(start, end, promotion)) {
      await message.channel?.sendMessage({
        content: 'This is not a valid move.',
        replies: [{ id: message._id, mention: false }],
      });
      continue;
    }

    currentTurn = currentTurn === 1 ? 2 : 1;
  }
}

interface StockfishOptions {
  Threads: string;
  Hash: string;
  Ponder: string;
  MultiPV: string;
  UseNNUE: string;
  UCIChess960: string;
  UCILimitStrength: string;
  UCIElo: string;
  SkillLevel: string;
  SlowMover: string;
}

async function startStockfishChessGame(
  client: Client,
  playerID: string,
  player1Color: PieceColor,
  channel: Channel | undefined,
  options: StockfishOptions
) {
  const engine = new Engine('stockfish');

  await engine.init();
  await engine.setoption('Threads', options.Threads);
  await engine.setoption('Hash', options.Hash);
  await engine.setoption('Ponder', options.Ponder);
  await engine.setoption('MultiPV', options.MultiPV);
  await engine.setoption('Use NNUE', options.UseNNUE);
  await engine.setoption('UCI_Chess960', options.UCIChess960);
  await engine.setoption('UCI_LimitStrength', options.UCILimitStrength);
  await engine.setoption('UCI_Elo', options.UCIElo);
  await engine.setoption('Skill Level', options.SkillLevel);
  await engine.setoption('Slow Mover', options.SlowMover);
  await engine.isready();

  const player2Color = player1Color === 'white' ? 'black' : 'white';

  await channel?.sendMessage(
    `Starting chess game between <@${playerID}> (${player1Color}) and <@${client.user?._id}> (${player2Color})`
  );

  const chessGame = new ChessGame();

  let currentTurn = player1Color === 'white' ? 1 : 2;

  while (true) {
    let move: string;
    if (currentTurn === 1) {
      const png = await chessGame.generateBoardPNG(currentTurn === 1 ? player1Color : player2Color);

      const attachment = await uploadToAutumn(client, png, 'chess.png', 'image/png');

      const message = await prompt(client, channel, playerID, {
        content: currentTurn === 1 ? `It's your turn, <@${playerID}>.` : null,
        attachments: [attachment],
      });

      if (message.content === null) {
        await channel?.sendMessage({
          content: `You must send a message in Pure Coordinate notation, meaning put the starting square first, then the ending square.
        Like this: e2e4. Even castling is put in as something like e1g1 instead of O-O or O-O-O.
        Some other examples:
          g1f3,
          g4h4q (pawn promotion, can use any of "q", "r", "b", or "n" to determine what the pawn is promoting to).`,
          replies: [{ id: message._id, mention: false }],
        });
        continue;
      }

      move = message.content;
    } else {
      const { bestmove } = await engine.go({ depth: 15 });
      move = bestmove;

      await channel?.sendMessage(`I will play... ${move}`);
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

    if (!chessGame.applyMove(start, end, promotion)) {
      await channel?.sendMessage({
        content: 'This is not a valid move.',
      });
      continue;
    }

    await engine.position(chessGame.fen);

    currentTurn = currentTurn === 1 ? 2 : 1;
  }
}
