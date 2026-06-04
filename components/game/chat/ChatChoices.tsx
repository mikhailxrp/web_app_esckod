'use client';

import { Button } from '@/components/ui/Button';
import { useChatStore } from '@/store/chatStore';
import type { ChatChoice, ChatType } from '@/types/chat';

interface ChatChoicesProps {
  chatType: ChatType;
  choices: ChatChoice[];
}

export function ChatChoices({ chatType, choices }: ChatChoicesProps): React.ReactElement {
  const choice = useChatStore((s) => s.choice);
  const status = useChatStore((s) =>
    chatType === 'DETECTIVE' ? s.detective.status : s.marina.status,
  );

  const isLoading = status === 'loading';

  return (
    <div className="flex flex-col gap-2" role="group" aria-label="Варианты ответа">
      {choices.map((c) => (
        <Button
          key={c.value}
          variant="secondary"
          loading={isLoading}
          onClick={() => void choice(chatType, c.value)}
          className="w-full text-left justify-start"
          aria-label={`Выбрать: ${c.label}`}
        >
          {c.label}
        </Button>
      ))}
    </div>
  );
}
