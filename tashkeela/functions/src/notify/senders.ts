import { getMessaging } from "firebase-admin/messaging";
import * as logger from "firebase-functions/logger";

export interface PushMessage {
  title: string;
  body: string;
  data: Record<string, string>;
}

export interface PushSender {
  /** Sends to the given app installations (FIDs) and returns the ones that no longer exist. */
  send(ids: string[], message: PushMessage): Promise<string[]>;
}

export interface WhatsAppSender {
  sendTemplate(
    to: string,
    template: string,
    language: string,
    bodyParams: string[],
    buttonPayloads?: string[],
  ): Promise<void>;
  sendText(to: string, text: string): Promise<void>;
}

export class FcmPushSender implements PushSender {
  async send(ids: string[], message: PushMessage): Promise<string[]> {
    if (!ids.length) return [];
    const res = await getMessaging().sendEachForMulticast({
      fids: ids,
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: { priority: "high", notification: { channelId: "game_updates" } },
      webpush: { fcmOptions: { link: message.data.link ?? "/" } },
    });
    const invalid: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code ?? "";
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalid.push(ids[i]);
      } else if (r.error) {
        logger.warn("push failed", { code, message: r.error.message });
      }
    });
    return invalid;
  }
}

export interface CloudApiConfig {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
}

/** WhatsApp Business Platform (Cloud API) over plain HTTPS. */
export class CloudApiWhatsApp implements WhatsAppSender {
  constructor(
    private readonly config: CloudApiConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async sendTemplate(
    to: string,
    template: string,
    language: string,
    bodyParams: string[],
    buttonPayloads: string[] = [],
  ): Promise<void> {
    const components: unknown[] = [];
    if (bodyParams.length) {
      components.push({
        type: "body",
        parameters: bodyParams.map((text) => ({ type: "text", text })),
      });
    }
    buttonPayloads.forEach((payload, index) =>
      components.push({
        type: "button",
        sub_type: "quick_reply",
        index: String(index),
        parameters: [{ type: "payload", payload }],
      }),
    );
    await this.post({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: { name: template, language: { code: language }, components },
    });
  }

  async sendText(to: string, text: string): Promise<void> {
    await this.post({ messaging_product: "whatsapp", to, type: "text", text: { body: text } });
  }

  private async post(body: unknown): Promise<void> {
    const url = `https://graph.facebook.com/${this.config.apiVersion}/${this.config.phoneNumberId}/messages`;
    const res = await this.fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
    }
  }
}
