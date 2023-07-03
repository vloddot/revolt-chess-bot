import { mkdir, writeFile } from 'fs/promises';
import { Client } from 'revolt.js';
import playChessCommand from '$commands/play-chess';
import dotenv from 'dotenv';
import ChessGame from '$lib/ChessGame';
import { existsSync } from 'fs';
import helpCommand from '$commands/help';

export interface StartBotOptions {
  onready?(client: Client): unknown;
}

export default async function startBot(token: string, options?: StartBotOptions): Promise<Client> {
  const client = new Client();

  client.once('ready', async () => {
    // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
    console.error('BOT_TOKEN is undefined. Make sure it is defined in the `.env` file.');
    process.exit(1);
  }

  startBot(process.env.BOT_TOKEN, {
    async onready() {
      if (!existsSync('.temp')) {
        await mkdir('.temp');
      }

      await writeFile('.temp/test.png', await new ChessGame().generateBoardPNG('white'));
    },
  });
}
