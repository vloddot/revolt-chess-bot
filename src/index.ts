import { Client } from 'revolt.js';
import { playChessCommand } from '$commands/play-chess';
import dotenv from 'dotenv';

export interface StartBotOptions {
  readyCallback?(client: Client): unknown;
}

export default async function startBot(token: string, options?: StartBotOptions): Promise<Client> {
  const client = new Client();

  client.once('ready', async () => {
    if (options?.readyCallback === undefined) {
      // eslint-disable-next-line no-console
      console.info(`Logged in as ${client.user?.username ?? '[logging in...]'}`);
      return;
    }

    await options.readyCallback(client);
  });

  client.on('message', async (message) => {
    const args = message.content?.split(' ');

    if (args === undefined) {
      return;
    }

    const command = args[0];

    if (command === '/play-chess') {
      await playChessCommand(client, message, args);
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

  startBot(process.env.BOT_TOKEN);
}
