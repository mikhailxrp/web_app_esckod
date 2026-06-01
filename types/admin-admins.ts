export interface AdminListItem {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface AdminDetail {
  id: string;
  email: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface CreateAdminResponse {
  id: string;
  email: string;
  password: string;
}

export interface ResetPasswordResponse {
  password: string;
}

export interface AdminAuditLogItem {
  id: string;
  type: string;
  message: string;
  createdAt: string;
}
