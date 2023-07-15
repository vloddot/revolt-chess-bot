import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import { Channel, Client, Message } from 'revolt.js';
import type { DataMessageSend } from '$lib/types';

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
  callback: (yes: boolean) => unknown,
  client: Client,
  channel?: Channel,
  expectedUserID?: string,
  promptMessage?: string | DataMessageSend
): Promise<void> {
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
  contents: Uint8Array,
  filename: string,
  contentType: string,
  tag = 'attachments'
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!client.configuration?.features.autumn.enabled) {
      reject('Autumn support is not enabled.');
    }

  const formData = new FormData();

  formData.append('file', Buffer.from(contents), {
    filename,
  });
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

export function load_asset(path: string): Uint8Array {
  return fs.readFileSync(`assets/${path}`);
}
