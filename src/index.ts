import fs from 'fs';
import { Client } from 'revolt.js';
import { playChessCommand } from '$commands/play-chess';
import dotenv from 'dotenv';
import ChessGame from '$lib/ChessGame';

dotenv.config();

const client = new Client();

client.once('ready', () => {
  console.info(`Logged in as ${client.user?.username ?? '[logging in...]'}`);
  fs.writeFileSync(
    'test.png',
    new ChessGame().generateBoardCanvasPNGData('white'),
    {
      encoding: 'binary',
    }
  );
});

client.on('message', async (message) => {
  const args = message.content?.split(' ');

  if (args === undefined) {
    return;
  }

  const command = args[0];

  if (command === '/playchess') {
    await playChessCommand(client, message, args);
  }
});

const token = process.env.BOT_TOKEN;
if (token === undefined) {
  console.error('BOT_TOKEN is undefined. Make sure it is defined in `.env`.');
  process.exit(1);
}

client.loginBot(token);
