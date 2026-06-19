export interface QuestionListItem {
  id: string;
  orderIndex: number;
  questionText: string;
  options: string[];
  correctOption: number;
  createdAt: string;
  updatedAt: string;
}

export type QuestionDetail = QuestionListItem;

export interface ContentItem {
  id: string;
  finalChoiceValue: string;
  title: string;
  bodyText: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryData {
  finalReportQuestionId: string | null;
  questions: QuestionListItem[];
  contents: ContentItem[];
}

export interface LinkImage {
  url: string;
  key: string;
}

export interface LinkBlock {
  id: string;
  blockIndex: number;
  text: string;
  images: LinkImage[];
  updatedAt: string;
}
