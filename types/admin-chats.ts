export type ChatType = 'DETECTIVE' | 'MARINA';

export type ChatAuthor = 'DETECTIVE' | 'PLAYER' | 'MARINA' | 'ANONYMOUS';

export interface ChatChoice {
  label: string;
  value: string;
}

export interface ChatScriptListItem {
  id: string;
  chatType: ChatType;
  author: ChatAuthor;
  code: string;
  text: string;
  audioUrl: string | null;
  hasChoices: boolean;
  choices: ChatChoice[] | null;
  isStart: boolean;
  isEnd: boolean;
  createdAt: string;
  updatedAt: string;
}
