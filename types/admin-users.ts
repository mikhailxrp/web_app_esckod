export interface UserListItem {
  id: string;
  email: string;
  name: string;
  isBlocked: boolean;
  createdAt: string;
  accessKey: { key: string } | null;
}

export interface UserStateSnapshot {
  user: {
    id: string;
    email: string;
    name: string;
    isBlocked: boolean;
    onboardingDone: boolean;
    consentMarketing: boolean;
    consentPolicy: boolean;
    createdAt: string;
    accessKey: { key: string; isBlocked: boolean } | null;
  };
  gameProgress: {
    marinaTriggered: boolean;
    finalReportDone: boolean;
    finalScore: number | null;
  } | null;
  chatState: {
    currentDetectiveMessage: { code: string; text: string } | null;
    currentMarinaMessage: { code: string; text: string } | null;
    playerChoices: Record<string, string>;
    finalChoice: string | null;
    detectiveFinished: boolean;
    marinaFinished: boolean;
  } | null;
  missionProgress: {
    slotKey: string;
    completed: boolean;
    completedAt: string | null;
    metadata: unknown;
  }[];
  crackSessions: {
    slotKey: string;
    attemptsUsed: number;
    maxAttempts: number;
  }[];
  hintProgress: { lastSeenHintIndex: number } | null;
  logsCount: number;
  recentLogs: {
    id: string;
    type: string;
    message: string;
    createdAt: string;
  }[];
}

export type UserStatusFilter = 'all' | 'active' | 'blocked';
export type UserSortValue = 'createdAt_desc' | 'createdAt_asc';
