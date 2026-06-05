'use client';

import { Button } from '@/components/ui/Button';
import { useChatStore } from '@/store/chatStore';
import type { ChatType } from '@/types/chat';

interface ChatAdvanceButtonProps {
  chatType: ChatType;
}

export function ChatAdvanceButton({ chatType }: ChatAdvanceButtonProps): React.ReactElement {
  const advance = useChatStore((s) => s.advance);
  const status = useChatStore((s) =>
    chatType === 'DETECTIVE' ? s.detective.status : s.marina.status,
  );

  const isLoading = status === 'loading';

  return (
    <Button
      variant="secondary"
      loading={isLoading}
      onClick={() => void advance(chatType)}
      className="w-full"
      aria-label="Следующая реплика"
    >
      Далее
    </Button>
  );
}
