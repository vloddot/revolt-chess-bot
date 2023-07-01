import axios from 'axios';
import FormData from 'form-data';
import { Channel, Client, Message } from 'revolt.js';
import type { DataMessageSend } from './types';

export async function prompt(
  client: Client,
  channel?: Channel,
  expectedUserID?: string,
  promptMessage?: string | DataMessageSend
): Promise<Message> {
  return new Promise((resolve: (value: Message) => void) => {
    if (promptMessage !== undefined) {
      channel?.sendMessage(promptMessage);
    }

    client.on('message', async function handler(message: Message) {
      if (expectedUserID === undefined || expectedUserID === message.author_id) {
        client.off('message', handler);
        resolve(message);
      }
    });
  });
}

export async function promptYesOrNo(
  client: Client,
  callback: (yes: boolean) => unknown,
  channel?: Channel,
  expectedUserID?: string,
  promptMessage?: string | DataMessageSend
) {
  while (true) {
    const message = await prompt(client, channel, expectedUserID, promptMessage);

    const isYes = Boolean(message.content?.match(/\b(yes|agree)\b/gi));
    const isNo = Boolean(message.content?.match(/\b(no|abort)\b/gi));

    if (isYes === isNo) {
      await channel?.sendMessage('Expected either yes or no.');
      continue;
    }

    await callback(isYes);
    break;
  }
}

export async function uploadToAutumn(
  client: Client,
  contents: string | Buffer,
  filename: string,
  contentType: string,
  tag = 'attachments'
): Promise<string> {
  const formData = new FormData();

  formData.append('file', contents, {
    filename,
  });

  return new Promise((resolve, reject) => {
    if (!client.configuration?.features.autumn.enabled) {
      reject('Autumn support is not enabled.');
    }

    axios
      .post(`${client.configuration?.features.autumn.url}/${tag}`, formData, {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
        },
      })
      .then((response) => resolve(response.data.id))
      .catch((error) => reject(error));
  });
}
