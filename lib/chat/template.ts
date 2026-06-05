import 'server-only';

import type { AdvanceResult, ChatMessageView } from '@/lib/chat/advance';

export const USER_EMAIL_TOKEN = '{{user.email}}';

export function applyChatTemplate(
  text: string | null,
  vars: { email: string },
): string | null {
  if (text === null) {
    return null;
  }

  return text.replaceAll(USER_EMAIL_TOKEN, () => vars.email);
}

export function applyTemplateToView(
  view: ChatMessageView,
  vars: { email: string },
): ChatMessageView {
  return {
    ...view,
    text: applyChatTemplate(view.text, vars),
  };
}

export function applyTemplateToAdvanceResult(
  result: AdvanceResult,
  vars: { email: string },
): AdvanceResult {
  switch (result.status) {
    case 'ok':
      return {
        ...result,
        currentMessage: applyTemplateToView(result.currentMessage, vars),
      };
    case 'waiting':
      return {
        ...result,
        currentMessage: applyTemplateToView(result.currentMessage, vars),
      };
    case 'choice_required':
      return {
        ...result,
        currentMessage: applyTemplateToView(result.currentMessage, vars),
      };
    case 'invalid_choice':
    case 'conflict':
    case 'no_start':
      return result;
    default: {
      const _exhaustive: never = result;
      return _exhaustive;
    }
  }
}
