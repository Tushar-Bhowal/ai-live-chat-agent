// Channels the agent can serve. A new channel is added by listing it here and
// providing an inbound adapter that calls the agent core (see README).
export const CHANNELS = ["livechat", "whatsapp", "instagram"] as const;

export type Channel = (typeof CHANNELS)[number];

export const DEFAULT_CHANNEL: Channel = "livechat";
