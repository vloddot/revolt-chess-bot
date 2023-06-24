import { Channel, Client, Message } from 'revolt.js';
import { prompt } from '$lib/helpers';
import ChessGame, { PieceColor } from '$lib/ChessGame';

export async function playChessCommand(
  client: Client,
  message: Message,
  args: string[]
) {
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

  async function promptColor(): Promise<PieceColor> {
    while (true) {
      const message = await prompt(
        'What color do you want to play as? Expect either "White", "Black", or "Random"',
        client,
        channel,
        player1ID
      );

      if (message.content === null) {
        await channel?.sendMessage('Expected message content.');
        continue;
      }

      const color = getColor(message.content);
      if (color === undefined) {
        continue;
      }

      return color;
    }
  }

  let player1Color: PieceColor = 'white';

  if (args.length > 3) {
    await channel?.sendMessage(
      `Expected at most 2 arguments. Found ${args.length - 1}
      Usage: /play-chess [color] [other-player]`
    );
    return;
  }

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
      const message = await prompt(
        'Who do you want to play against?',
        client,
        channel,
        player1ID
      );

      if (
        message.mention_ids === null ||
        message.mention_ids.length !== 1 ||
        message.mention_ids[0] === player1ID
      ) {
        await channel?.sendMessage('Expected one mention to another user.');
        return;
      }

      player2ID = message.mention_ids[0];
    }
  } else if (message.mention_ids.length !== 1) {
    await message.channel?.sendMessage(
      'Expected only one person to play against.'
    );
    return;
  } else {
    player2ID = message.mention_ids[0];
  }

  while (true) {
    const promptMessage = await prompt(
      `Do you want to play against <@${player1ID}>, <@${player2ID}>?`,
      client,
      channel,
      player2ID
    );

    const isYes = promptMessage.content?.match(/\b(yes|agree)\b/gi);
    const isNo = promptMessage.content?.match(/\b(no|abort)\b/gi);

    if (isYes && isNo) {
      await channel?.sendMessage('Expected either yes or no.');
      continue;
    }

    if (isYes) {
      await startChessGame(player1ID, player2ID, player1Color, channel);
      break;
    }

    if (isNo) {
      await channel?.sendMessage('Aborting chess game.');
      break;
    }

    await channel?.sendMessage('Expected yes or no answer.');
  }
}

async function startChessGame(
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

  const turn = player1Color === 'white' ? 1 : 2;

  chessGame.generateBoardCanvasPNGData(
    turn === 1 ? player1Color : player2Color
  );
}
