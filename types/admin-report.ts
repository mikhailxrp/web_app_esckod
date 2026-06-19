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
