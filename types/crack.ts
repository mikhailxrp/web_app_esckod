export type LetterStatus = 'correct' | 'wrong-position' | 'absent';

export interface AttemptEntry {
  word: string;
  positions: LetterStatus[];
}

export interface CrackField {
  targetWord: string;
  wordList: string[];
}

/** Состояние активной сессии, отдаваемое клиенту (без targetWord). */
export interface CrackActiveState {
  isActive: true;
  isCompleted: false;
  wordList: string[];
  attemptsUsed: number;
  attempts: AttemptEntry[];
  maxAttempts: number;
  failedSessionsCount: number;
  canSkip: boolean;
  version: number;
  hintText: string | null;
  targetUrl: string | null;
  targetEmail: string | null;
}

/** Состояние пройденной миссии. */
export interface CrackCompletedState {
  isCompleted: true;
  resultPassword: string | null;
  targetUrl: string | null;
  targetEmail: string | null;
  hintText: string | null;
}

export type CrackState = CrackActiveState | CrackCompletedState;

/** Ответ на попытку (targetWord никогда не возвращается). */
export interface CrackAttemptResult {
  isCorrect: boolean;
  isFailed: boolean;
  attemptsUsed: number;
  positions: LetterStatus[];
  version: number;
  newWordList?: string[];
  canSkip?: boolean;
}

/** Ответ на завершение/пропуск миссии. */
export interface CrackCompleteResult {
  success: true;
  resultPassword: string | null;
  targetUrl: string | null;
  targetEmail: string | null;
}
