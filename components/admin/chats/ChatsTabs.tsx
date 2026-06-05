'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type {
  ChatScriptListItem,
  ChatTransitionListItem,
  TriggerValueOption,
} from '@/types/admin-chats';
import { ChatGraphValidatorBanner } from './ChatGraphValidatorBanner';
import { ChatScriptsTable } from './ChatScriptsTable';
import { ChatTransitionsTable } from './ChatTransitionsTable';

const TABS = ['Реплики', 'Переходы'] as const;
type Tab = (typeof TABS)[number];

interface ChatsTabsProps {
  initialScripts: ChatScriptListItem[];
  initialTransitions: ChatTransitionListItem[];
  initialTriggerValues: TriggerValueOption[];
}

export function ChatsTabs({
  initialScripts,
  initialTransitions,
  initialTriggerValues,
}: ChatsTabsProps): React.ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('Реплики');
  const [scripts, setScripts] = useState<ChatScriptListItem[]>(initialScripts);
  const [transitions, setTransitions] =
    useState<ChatTransitionListItem[]>(initialTransitions);
  const [triggerValues, setTriggerValues] =
    useState<TriggerValueOption[]>(initialTriggerValues);
  const [validatorReloadKey, setValidatorReloadKey] = useState(0);

  const refreshValidator = useCallback((): void => {
    setValidatorReloadKey((k) => k + 1);
  }, []);

  const refreshScripts = useCallback(async (): Promise<void> => {
    try {
      const res = await fetch('/api/admin/chats/scripts');

      if (res.ok) {
        const data = (await res.json()) as ChatScriptListItem[];
        setScripts(data);
      }
    } catch {
      // silent
    } finally {
      router.refresh();
    }
  }, [router]);

  const refreshTransitions = useCallback(async (): Promise<void> => {
    try {
      const [transitionsRes, triggersRes] = await Promise.all([
        fetch('/api/admin/chats/transitions'),
        fetch('/api/admin/chats/trigger-values'),
      ]);

      if (transitionsRes.ok) {
        const data = (await transitionsRes.json()) as ChatTransitionListItem[];
        setTransitions(data);
      }

      if (triggersRes.ok) {
        const data = (await triggersRes.json()) as { values: TriggerValueOption[] };
        setTriggerValues(data.values);
      }
    } catch {
      // silent
    } finally {
      router.refresh();
    }
  }, [router]);

  const handleScriptsMutated = useCallback(async (): Promise<void> => {
    await Promise.all([refreshScripts(), refreshTransitions()]);
    refreshValidator();
  }, [refreshScripts, refreshTransitions, refreshValidator]);

  const handleTransitionsMutated = useCallback(async (): Promise<void> => {
    await refreshTransitions();
    refreshValidator();
  }, [refreshTransitions, refreshValidator]);

  return (
    <>
      <ChatGraphValidatorBanner reloadKey={validatorReloadKey} />

      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab
                ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Реплики' ? (
        <ChatScriptsTable
          scripts={scripts}
          onScriptsMutated={() => void handleScriptsMutated()}
        />
      ) : (
        <ChatTransitionsTable
          transitions={transitions}
          scripts={scripts}
          triggerValues={triggerValues}
          onTransitionsMutated={() => void handleTransitionsMutated()}
        />
      )}
    </>
  );
}
