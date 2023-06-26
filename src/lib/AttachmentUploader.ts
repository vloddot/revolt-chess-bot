import FormData from 'form-data';
import axios from 'axios';
import { Client } from 'revolt.js';

/**
 * Class to upload attachments to revolt server.
 */
export default class Uploader {
  client: Client;
  url?: string;
  ready?: boolean;

  constructor(client: Client) {
    this.client = client;

    if (client.configuration) {
      this.url = client.configuration.features.autumn.url;
      this.ready = true;
    }

    this.client.once('ready', () => {
      this.url = client.configuration?.features.autumn.url;
      this.ready = true;
    });
  }

  /**
   *
   * @param {Buffer} contents File contents
   * @param {string} filename File name
   * @returns
   */
  upload(
    contents: Buffer,
    filename: string,
    tag = 'attachments',
    contentType = 'image/png'
  ): Promise<string> {
    if (!this.ready) {
      throw new Error('Client is not ready yet.');
    }

    const formData = new FormData();

    formData.append('file', contents, {
      filename,
    });

    return new Promise((resolve, reject) => {
      axios
        .post(`${this.url}/${tag}`, formData, {
          method: 'POST',
          headers: {
            'Content-Type': contentType,
          },
        })
        .then((response) => resolve(response.data.id))
        .catch((error) => reject(error));
    });
  }
}
