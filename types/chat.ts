import type { ChatAuthor, ChatType } from '@prisma/client';

export type { ChatType };

export interface ChatChoice {
  label: string;
  value: string;
}

export interface ChatMessageView {
  id: string;
  code: string;
  text: string | null;
  author: ChatAuthor;
  audioUrl: string | null;
  hasChoices: boolean;
  choices: ChatChoice[] | null;
  isEnd: boolean;
}
