import {
  ChatType,
  ConditionType,
  type ChatScript,
  type ChatTransition,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseChoices } from '@/lib/validations/admin-chats';

export type ChatGraphIssueType =
  | 'NO_OUTGOING'
  | 'NO_INGOING'
  | 'CHOICE_NOT_COVERED'
  | 'END_UNREACHABLE'
  | 'NO_START'
  | 'MULTIPLE_START'
  | 'DANGLING_EDGE'
  | 'INVALID_CHOICES';

export interface ChatGraphIssue {
  type: ChatGraphIssueType;
  message: string;
  chatType?: ChatType;
  code?: string;
}

export interface ChatGraphValidationResult {
  valid: boolean;
  issues: ChatGraphIssue[];
}

const CHAT_TYPES: ChatType[] = [ChatType.DETECTIVE, ChatType.MARINA];

const CHAT_TYPE_LABELS: Record<ChatType, string> = {
  [ChatType.DETECTIVE]: 'Детектив',
  [ChatType.MARINA]: 'Марина',
};

function collectReachableIds(
  startId: string,
  outgoingByFrom: Map<string, ChatTransition[]>,
): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [startId];

  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId || visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);

    const outgoing = outgoingByFrom.get(currentId) ?? [];

    for (const transition of outgoing) {
      if (!visited.has(transition.toMessageId)) {
        queue.push(transition.toMessageId);
      }
    }
  }

  return visited;
}

function validateDanglingEdges(
  transitions: ChatTransition[],
  scriptById: Map<string, ChatScript>,
  issues: ChatGraphIssue[],
): void {
  for (const transition of transitions) {
    const fromScript = scriptById.get(transition.fromMessageId);
    const toScript = scriptById.get(transition.toMessageId);

    if (!fromScript) {
      issues.push({
        type: 'DANGLING_EDGE',
        message: `Переход ссылается на несуществующую исходную реплику (id: ${transition.fromMessageId})`,
      });
    }

    if (!toScript) {
      issues.push({
        type: 'DANGLING_EDGE',
        message: `Переход ссылается на несуществующую целевую реплику (id: ${transition.toMessageId})`,
        chatType: fromScript?.chatType,
        code: fromScript?.code,
      });
    }
  }
}

function validateStartNodes(
  chatType: ChatType,
  chatScripts: ChatScript[],
  issues: ChatGraphIssue[],
): ChatScript | null {
  const starts = chatScripts.filter((script) => script.isStart);
  const label = CHAT_TYPE_LABELS[chatType];

  if (starts.length === 0) {
    issues.push({
      type: 'NO_START',
      message: `В чате «${label}» не найдена начальная реплика (isStart)`,
      chatType,
    });
    return null;
  }

  if (starts.length > 1) {
    const codes = starts.map((script) => script.code).join(', ');
    issues.push({
      type: 'MULTIPLE_START',
      message: `В чате «${label}» несколько начальных реплик: ${codes}`,
      chatType,
    });
    return null;
  }

  return starts[0];
}

function validateScriptOutcomes(
  script: ChatScript,
  outgoing: ChatTransition[],
  issues: ChatGraphIssue[],
): void {
  if (!script.hasChoices && !script.isEnd) {
    const alwaysOrTriggerCount = outgoing.filter(
      (transition) =>
        transition.conditionType === ConditionType.ALWAYS ||
        transition.conditionType === ConditionType.TRIGGER,
    ).length;

    if (alwaysOrTriggerCount === 0) {
      issues.push({
        type: 'NO_OUTGOING',
        message: `Реплика «${script.code}» не имеет исходящих переходов (ALWAYS/TRIGGER)`,
        chatType: script.chatType,
        code: script.code,
      });
    }
  }

  if (!script.hasChoices) {
    return;
  }

  const choices = parseChoices(script.choices);

  if (!choices) {
    issues.push({
      type: 'INVALID_CHOICES',
      message: `Реплика «${script.code}» с hasChoices=true не имеет валидных choices`,
      chatType: script.chatType,
      code: script.code,
    });
    return;
  }

  const coveredValues = new Set(
    outgoing
      .filter((transition) => transition.conditionType === ConditionType.CHOICE)
      .map((transition) => transition.conditionValue)
      .filter((value): value is string => value !== null && value.length > 0),
  );

  for (const choice of choices) {
    if (!coveredValues.has(choice.value)) {
      issues.push({
        type: 'CHOICE_NOT_COVERED',
        message: `Для выбора «${choice.value}» реплики «${script.code}» нет перехода CHOICE`,
        chatType: script.chatType,
        code: script.code,
      });
    }
  }
}

function validateEndReachability(
  chatType: ChatType,
  startScript: ChatScript,
  chatScripts: ChatScript[],
  outgoingByFrom: Map<string, ChatTransition[]>,
  issues: ChatGraphIssue[],
): void {
  const reachable = collectReachableIds(startScript.id, outgoingByFrom);
  const endNodes = chatScripts.filter((script) => script.isEnd);
  const hasReachableEnd = endNodes.some((script) => reachable.has(script.id));

  if (!hasReachableEnd) {
    issues.push({
      type: 'END_UNREACHABLE',
      message: `Нет пути от начальной реплики до концовки в чате «${CHAT_TYPE_LABELS[chatType]}»`,
      chatType,
      code: startScript.code,
    });
  }
}

function validateNoIngoing(
  chatType: ChatType,
  chatScripts: ChatScript[],
  transitions: ChatTransition[],
  issues: ChatGraphIssue[],
): void {
  const incomingTargets = new Set(transitions.map((t) => t.toMessageId));

  for (const script of chatScripts) {
    if (!script.isStart && !incomingTargets.has(script.id)) {
      issues.push({
        type: 'NO_INGOING',
        message: `Реплика недостижима — нет входящих переходов и не является стартовой`,
        chatType,
        code: script.code,
      });
    }
  }
}

export async function validateChatGraph(): Promise<ChatGraphValidationResult> {
  const [scripts, transitions] = await Promise.all([
    prisma.chatScript.findMany(),
    prisma.chatTransition.findMany(),
  ]);

  const scriptById = new Map<string, ChatScript>(
    scripts.map((script) => [script.id, script]),
  );

  const outgoingByFrom = new Map<string, ChatTransition[]>();

  for (const transition of transitions) {
    const existing = outgoingByFrom.get(transition.fromMessageId) ?? [];
    existing.push(transition);
    outgoingByFrom.set(transition.fromMessageId, existing);
  }

  const issues: ChatGraphIssue[] = [];

  validateDanglingEdges(transitions, scriptById, issues);

  for (const chatType of CHAT_TYPES) {
    const chatScripts = scripts.filter((script) => script.chatType === chatType);
    const startScript = validateStartNodes(chatType, chatScripts, issues);

    for (const script of chatScripts) {
      const outgoing = outgoingByFrom.get(script.id) ?? [];
      validateScriptOutcomes(script, outgoing, issues);
    }

    validateNoIngoing(chatType, chatScripts, transitions, issues);

    if (startScript) {
      validateEndReachability(
        chatType,
        startScript,
        chatScripts,
        outgoingByFrom,
        issues,
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
