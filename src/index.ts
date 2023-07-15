import { Client } from 'revolt.js';
import playChessCommand from '$commands/play-chess';
import dotenv from 'dotenv';
import helpCommand from '$commands/help';
import { uploadToAutumn } from '$lib/helpers';

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

    try {
      switch (command) {
        case '/play-chess':
          await playChessCommand(client, message, args);
          break;
        case '/help':
          await helpCommand(client, message, args);
          break;
      }
    } catch (error) {
      const attachment = await uploadToAutumn(client, new TextEncoder().encode(String(error)), 'error.log', 'text')
      await message.channel?.sendMessage({
        content: 'An error occured, sorry for the inconvenience, error was saved in a log file:',
        attachments: [attachment],
      });
      console.error(error);
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

  startBot(process.env.BOT_TOKEN);
}
