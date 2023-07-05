import { Client } from 'revolt.js';
import playChessCommand from '$commands/play-chess';
import dotenv from 'dotenv';
import helpCommand from '$commands/help';
import { ChessGame, Player } from 'chess-game/pkg/chess_game';
import { readFile, writeFile } from 'fs/promises';

export interface StartBotOptions {
  onready?(client: Client): unknown;
}

export default async function startBot(token: string, options?: StartBotOptions): Promise<Client> {
  const client = new Client();

  client.once('ready', async () => {
    console.info(`Logged in as ${client.user?.username ?? '[logging in...]'}`);

    if (options?.onready !== undefined) {
      await options?.onready(client);
    }
  });

  client.on('message', async (message) => {
    const args = message.content?.split(' ');

    if (args === undefined) {
      return;
    }

    const command = args[0];

    switch (command) {
      case '/play-chess':
        await playChessCommand(client, message, args);
        break;
      case '/help':
        await helpCommand(client, message, args);
        break;
    }
  });

  await client.loginBot(token);
  return client;
}

if (require.main?.id === module.id) {
  dotenv.config();
  if (process.env.BOT_TOKEN === undefined) {
    console.error('BOT_TOKEN is undefined. Make sure it is defined in the `.env` file.');
    process.exit(1);
  }

  startBot(process.env.BOT_TOKEN, {
    async onready() {
      const game = new ChessGame();

      await writeFile(
        '.temp/test.png',
        game.generateBoardPNG(Player.White, await readFile('OpenSans.ttf'))
      );
    },
  });
}
