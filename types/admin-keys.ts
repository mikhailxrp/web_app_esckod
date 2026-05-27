export interface AccessKeyListItem {
  id: string;
  key: string;
  isBlocked: boolean;
  blockedAt: string | null;
  maxActivations: number;
  currentActivations: number;
  createdAt: string;
}

export interface AccessKeyUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  isBlocked: boolean;
}

export interface AccessKeyDetail extends AccessKeyListItem {
  blockReason: string | null;
  users: AccessKeyUser[];
}

export interface KeysListResponse {
  keys: AccessKeyListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export type SortValue = 'createdAt_asc' | 'createdAt_desc';
export type StatusFilter = 'all' | 'active' | 'blocked';
export type ActivationsFilter = 'all' | 'lt5' | 'eq5' | 'gt5';

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}
