import { Channel, Client, Message } from 'revolt.js';

export async function prompt(
  client: Client,
  channel?: Channel,
  expectedID?: string,
  prompt?: string
): Promise<Message> {
  if (prompt !== undefined) {
    await channel?.sendMessage(prompt);
  }

  function handleEvent(message: Message, resolve: (value: Message) => void) {
    if (expectedID === undefined || expectedID === message.author_id) {
      resolve(message);
    }

    client.removeListener('message', promise);
  }

  function promise(resolve: (value: Message) => void) {
    client.on('message', (message) => handleEvent(message, resolve));
  }

  return new Promise(promise);
}
