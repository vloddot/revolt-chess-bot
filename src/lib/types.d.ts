export declare interface Reply {
  id: string;
  mention: boolean;
}

export declare interface Embed {
  icon_url?: string | null;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  media?: string | null;
  colour?: string | null;
}

export declare interface Masquerade {
  name?: string | null;
  avatar?: string | null;
  colour?: string | null;
}

export declare interface Interactions {
  reactions?: string[] | null;
  restrict_reactions?: boolean;
}

export declare interface DataMessageSend {
  nonce?: string;
  content?: string | null;
  attachments?: string[] | null;
  replies?: Reply[] | null;
  embeds?: Embed[] | null;
  masquerade?: Masquerade | null;
  interactions?: Interactions | null;
}
