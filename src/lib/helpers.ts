import axios from 'axios';
import FormData from 'form-data';
import { Channel, Client, Message } from 'revolt.js';
import type { DataMessageSend } from './types';

export async function prompt(
  client: Client,
  channel?: Channel,
  expectedUserID?: string,
  prompt?: string | DataMessageSend
): Promise<Message> {
  return new Promise((resolve: (value: Message) => void) => {
    if (prompt !== undefined) {
      channel?.sendMessage(prompt);
    }

    client.on('message', async function handler(message: Message) {
      process.stdout.write('got message');
      if (expectedUserID === undefined || expectedUserID === message.author_id) {
        console.log(' is expected');
        console.log('------------------')
        client.off('message', handler);
        resolve(message);
      }
      process.stdout.write('\n');
    });
  });
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
