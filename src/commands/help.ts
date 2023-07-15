import fs from 'fs/promises';
import { Client, Message } from 'revolt.js';

const COMMAND_HELP_DIR = 'command-help';
const SHORT_HELP_SUFFIX = '.short.md';
const LONG_HELP_SUFFIX = '.long.md';

export default async function helpCommand(client: Client, message: Message, args: string[]): Promise<void> {
  if (args.length === 1) {
    const helpFileNames: string[] = (await fs.readdir(COMMAND_HELP_DIR)).filter((name) =>
      name.endsWith(SHORT_HELP_SUFFIX)
    );

    let helpFileContents: Buffer[];

    try {
      helpFileContents = await Promise.all(
        helpFileNames.map((name) => fs.readFile(`${COMMAND_HELP_DIR}/${name}`))
      );
    } catch (error) {
      console.error(`Error when reading a help file: ${error}`);
      await message.channel?.sendMessage('Could not retreive help files, soz :(');
      return;
    }

    const helpFiles: [string, Buffer][] = helpFileNames.map((name, i) => [
      name,
      helpFileContents[i],
    ]);

    await message.channel?.sendMessage(
      `Stockfish. A chess bot for Revolt.

      If you want help about a specific command, use this syntax instead: /help <command>
      Commands:

        ${helpFiles.map(([name, help]) => `/${name.replace(SHORT_HELP_SUFFIX, '')}: ${help}`).join('').trim()}`
    );
    return;
  }

  const command = args[1];

  let helpFileContents: Buffer;
  try {
    helpFileContents = await fs.readFile(`${COMMAND_HELP_DIR}/${command}${LONG_HELP_SUFFIX}`);
  } catch (error) {
    console.log(`Error when reading a help file: ${error}`);
    await message.channel?.sendMessage('Could not retreive help files, soz :(');
    return;
  }

  await message.channel?.sendMessage(helpFileContents.toString('utf-8').trim());
}
