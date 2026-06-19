/**
 * Channels the agent can serve. Live chat is wired up today; messaging channels
 * such as WhatsApp or Instagram are added by listing them here and providing an
 * inbound adapter that calls the agent core (see README in this folder).
 */
export const CHANNELS = ["livechat", "whatsapp", "instagram"] as const;

export type Channel = (typeof CHANNELS)[number];

export const DEFAULT_CHANNEL: Channel = "livechat";

export function isChannel(value: string): value is Channel {
  return (CHANNELS as readonly string[]).includes(value);
}
