'use client';

import { create } from 'zustand';

export interface OperationLogEntry {
  id: string;
  type: 'SUCCESS' | 'ERROR' | 'INFO';
  message: string;
  createdAt: string;
}

interface LogStore {
  logs: OperationLogEntry[];
  setLogs: (logs: OperationLogEntry[]) => void;
  refreshLogs: () => Promise<void>;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  setLogs: (logs) => set({ logs }),
  refreshLogs: async () => {
    try {
      const response = await fetch('/api/logs');

      if (!response.ok) {
        console.error('Failed to fetch logs:', response.status);
        return;
      }

      const data = (await response.json()) as { logs: OperationLogEntry[] };
      set({ logs: data.logs });
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  },
}));
