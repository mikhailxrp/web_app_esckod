"use client";

import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useEffect, useCallback } from "react";
import type { MissionType } from "@prisma/client";
import {
  crackLaunchSchema,
  decipherLaunchSchema,
  rdpLaunchSchema,
  type CrackLaunchInput,
  type DecipherLaunchInput,
  type RdpLaunchInput,
} from "@/lib/validations/missions";
import { ONBOARDING_TARGETS } from "@/constants/onboardingSteps";
import { useLogStore } from "@/store/logStore";
import type { RdpConnectResult } from "@/types/rdp";

const MISSION_ONBOARDING_ID: Record<MissionType, string> = {
  CRACK: ONBOARDING_TARGETS.CRACK_MISSION_CARD,
  DECIPHER: ONBOARDING_TARGETS.DECIPHER_MISSION_CARD,
  RDP: ONBOARDING_TARGETS.RDP_MISSION_CARD,
};

// ─── Static config per mission type ──────────────────────────────────────────

interface MissionConfig {
  label: string;
  iconSrc: string;
  iconAlt: string;
}

const MISSION_CONFIG: Record<MissionType, MissionConfig> = {
  CRACK: {
    label: "Взломщик",
    iconSrc: "/assets/img/icon/cracker-icon.svg",
    iconAlt: "Иконка миссии Взломщик",
  },
  DECIPHER: {
    label: "Дешифратор",
    iconSrc: "/assets/img/icon/decoder-icon.svg",
    iconAlt: "Иконка миссии Дешифратор",
  },
  RDP: {
    label: "Удаленный доступ",
    iconSrc: "/assets/img/icon/remote-access-icon.svg",
    iconAlt: "Иконка миссии Удаленный доступ",
  },
};

// ─── Shared field + button styles ────────────────────────────────────────────

const INPUT_CLASS =
  "h-input-height w-full rounded-game-lg border border-border bg-bg-input px-4 font-mono text-game-base text-content-primary placeholder:text-content-muted focus:border-border-focus focus:shadow-game-focus focus:outline-none";

const LABEL_CLASS = "font-mono text-game-base text-content-secondary";

// CRACK-кнопка функциональна; Decipher/RDP подключаются в Phase 12/14
const SUBMIT_BTN_CLASS =
  "mt-2 h-input-height w-full rounded-game-full bg-accent font-mono text-[20px] uppercase tracking-game-wide text-content-inverse disabled:cursor-not-allowed disabled:opacity-50";

// ─── Form: CRACK ──────────────────────────────────────────────────────────────

interface CrackFormProps {
  onLaunched: (slotKey: string) => void;
}

function CrackForm({ onLaunched }: CrackFormProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CrackLaunchInput>({
    resolver: zodResolver(crackLaunchSchema),
    mode: "onChange",
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const refreshLogs = useLogStore((s) => s.refreshLogs);

  const onSubmit = async (values: CrackLaunchInput): Promise<void> => {
    setServerError(null);

    try {
      const res = await fetch("/api/missions/crack/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.status === 429) {
        setServerError("Слишком много попыток. Подождите минуту.");
        return;
      }

      if (!res.ok) {
        setServerError("Ошибка доступа. Проверьте данные.");
        await refreshLogs();
        return;
      }

      const data = (await res.json()) as { slotKey: string };
      onLaunched(data.slotKey);
    } catch {
      setServerError("Ошибка соединения. Попробуйте еще раз.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-[420px] flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="crack-targetUrl" className={LABEL_CLASS}>
          Ссылка
        </label>
        <input
          {...register("targetUrl")}
          id="crack-targetUrl"
          type="url"
          aria-invalid={Boolean(errors.targetUrl)}
          className={INPUT_CLASS}
        />
        {errors.targetUrl ? (
          <p
            className="font-mono text-game-sm text-semantic-error"
            role="alert"
          >
            {errors.targetUrl.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="crack-targetEmail" className={LABEL_CLASS}>
          Почта
        </label>
        <input
          {...register("targetEmail")}
          id="crack-targetEmail"
          type="text"
          aria-invalid={Boolean(errors.targetEmail)}
          className={INPUT_CLASS}
        />
        {errors.targetEmail ? (
          <p
            className="font-mono text-game-sm text-semantic-error"
            role="alert"
          >
            {errors.targetEmail.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p className="font-mono text-game-sm text-semantic-error" role="alert">
          {serverError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={SUBMIT_BTN_CLASS}
      >
        Начать
      </button>
    </form>
  );
}

// ─── Form: DECIPHER ───────────────────────────────────────────────────────────

interface DecipherFormProps {
  onLaunched: (slotKey: string) => void;
}

function DecipherForm({ onLaunched }: DecipherFormProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DecipherLaunchInput>({
    resolver: zodResolver(decipherLaunchSchema),
    mode: "onChange",
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const refreshLogs = useLogStore((s) => s.refreshLogs);

  const onSubmit = async (values: DecipherLaunchInput): Promise<void> => {
    setServerError(null);

    try {
      const res = await fetch("/api/missions/decipher/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.status === 429) {
        setServerError("Слишком много попыток. Подождите минуту.");
        return;
      }

      if (!res.ok) {
        setServerError("Путь или ключ не распознаны.");
        await refreshLogs();
        return;
      }

      const data = (await res.json()) as { slotKey: string };
      onLaunched(data.slotKey);
    } catch {
      setServerError("Ошибка соединения. Попробуйте еще раз.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-[420px] flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="decipher-folderPath" className={LABEL_CLASS}>
          Ссылка / путь
        </label>
        <input
          {...register("folderPath")}
          id="decipher-folderPath"
          type="text"
          aria-invalid={Boolean(errors.folderPath)}
          className={INPUT_CLASS}
        />
        {errors.folderPath ? (
          <p
            className="font-mono text-game-sm text-semantic-error"
            role="alert"
          >
            {errors.folderPath.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="decipher-cipherKey" className={LABEL_CLASS}>
          Ключ
        </label>
        <input
          {...register("cipherKey")}
          id="decipher-cipherKey"
          type="text"
          aria-invalid={Boolean(errors.cipherKey)}
          className={INPUT_CLASS}
        />
        {errors.cipherKey ? (
          <p
            className="font-mono text-game-sm text-semantic-error"
            role="alert"
          >
            {errors.cipherKey.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p className="font-mono text-game-sm text-semantic-error" role="alert">
          {serverError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={SUBMIT_BTN_CLASS}
      >
        Начать
      </button>
    </form>
  );
}

// ─── Form: RDP ────────────────────────────────────────────────────────────────

interface RdpFormProps {
  onLaunched: (data: RdpConnectResult) => void;
}

function RdpForm({ onLaunched }: RdpFormProps): React.ReactElement {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RdpLaunchInput>({
    resolver: zodResolver(rdpLaunchSchema),
    mode: "onChange",
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const refreshLogs = useLogStore((s) => s.refreshLogs);

  const onSubmit = async (values: RdpLaunchInput): Promise<void> => {
    setServerError(null);

    try {
      const res = await fetch("/api/missions/rdp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.status === 429) {
        setServerError("Слишком много попыток. Подождите минуту.");
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (data.error === "INVALID_IP") {
          setServerError("IP не распознан. Проверьте адрес.");
        } else {
          setServerError("Ошибка подключения. Попробуйте еще раз.");
        }
        await refreshLogs();
        return;
      }

      const data = (await res.json()) as RdpConnectResult;
      onLaunched(data);
    } catch {
      setServerError("Ошибка соединения. Попробуйте еще раз.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto flex w-full max-w-[420px] flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor="rdp-ip" className={LABEL_CLASS}>
          IP адрес
        </label>
        <input
          {...register("ip")}
          id="rdp-ip"
          type="text"
          aria-invalid={Boolean(errors.ip)}
          className={INPUT_CLASS}
          placeholder="192.168.1.1"
        />
        {errors.ip ? (
          <p
            className="font-mono text-game-sm text-semantic-error"
            role="alert"
          >
            {errors.ip.message}
          </p>
        ) : null}
      </div>

      {serverError ? (
        <p className="font-mono text-game-sm text-semantic-error" role="alert">
          {serverError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className={SUBMIT_BTN_CLASS}
      >
        Подключиться
      </button>
    </form>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface MissionModalProps {
  missionType: MissionType;
  onClose: () => void;
  onLaunched: (slotKey: string) => void;
  onRdpLaunched?: (data: RdpConnectResult) => void;
}

function MissionModal({
  missionType,
  onClose,
  onLaunched,
  onRdpLaunched,
}: MissionModalProps): React.ReactElement {
  const config = MISSION_CONFIG[missionType];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="fixed inset-0 z-card flex animate-modal-backdrop items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Миссия ${config.label}`}
      onClick={onClose}
    >
      <div
        className="flex h-[530px] w-full max-w-[840px] animate-modal-panel flex-col rounded-game-lg border border-border bg-bg-primary shadow-game-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <Image
            src={config.iconSrc}
            alt=""
            width={30}
            height={30}
            aria-hidden="true"
          />
          <span className="font-mono text-[20px] text-accent">
            {config.label}
          </span>

          <div className="min-w-0 flex-1 overflow-hidden">
            <span
              className="ml-auto pr-2 flex h-7 w-[calc(50%+70px)] items-center overflow-hidden whitespace-nowrap font-mono text-xl font-normal leading-none tracking-[-0.3em] text-white/30 select-none [direction:rtl]"
              aria-hidden="true"
            >
              {"/ ".repeat(30)}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть форму"
            className="flex size-7 items-center justify-center rounded-game-sm border border-border transition-colors hover:border-accent"
          >
            <Image
              src="/assets/icons/close.svg"
              alt=""
              width={16}
              height={16}
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Modal body — форма центрирована */}
        <div className="flex flex-1 items-center justify-center px-8 py-6">
          {missionType === "CRACK" ? (
            <CrackForm onLaunched={onLaunched} />
          ) : missionType === "DECIPHER" ? (
            <DecipherForm onLaunched={onLaunched} />
          ) : (
            <RdpForm
              onLaunched={(data) => {
                onClose();
                onRdpLaunched?.(data);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── MissionCard ──────────────────────────────────────────────────────────────

interface MissionCardProps {
  missionType: MissionType;
  onCrackLaunched?: (slotKey: string) => void;
  onDecipherLaunched?: (slotKey: string) => void;
  onRdpLaunched?: (data: RdpConnectResult) => void;
  /** Режим демонстрации в онбординге — не вызывает реальный API */
  demo?: boolean;
  /** Вызывается при клике «Открыть» в demo-режиме вместо открытия модала */
  onDemoStart?: () => void;
}

export function MissionCard({
  missionType,
  onCrackLaunched,
  onDecipherLaunched,
  onRdpLaunched,
  demo = false,
  onDemoStart,
}: MissionCardProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const config = MISSION_CONFIG[missionType];

  const handleLaunched = (slotKey: string): void => {
    setIsOpen(false);
    if (missionType === "CRACK" && onCrackLaunched) onCrackLaunched(slotKey);
    if (missionType === "DECIPHER" && onDecipherLaunched)
      onDecipherLaunched(slotKey);
  };

  const handleRdpLaunched = (data: RdpConnectResult): void => {
    setIsOpen(false);
    onRdpLaunched?.(data);
  };

  const handleOpenClick = (): void => {
    if (demo) {
      onDemoStart?.();
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      <article
        className="flex min-h-[200px] flex-col rounded-game-xl border border-white bg-[rgba(255,255,255,0.08)] backdrop-blur-sm 2xl:min-h-[380px]"
        data-onboarding-id={MISSION_ONBOARDING_ID[missionType]}
      >
        {/* Card header */}
        <div className="border-b border-white/30 px-4 pb-3 pt-4">
          <span className="font-mono text-game-lg text-accent">
            {config.label}
          </span>
        </div>

        {/* Card icon area */}
        <div className="flex flex-1 items-center justify-center p-6 [background:radial-gradient(ellipse_at_50%_50%,rgba(68,223,215,0.20)_0%,transparent_70%)]">
          <Image
            src={config.iconSrc}
            alt={config.iconAlt}
            width={170}
            height={170}
            className="h-[100px] w-[100px] 2xl:h-[170px] 2xl:w-[170px]"
          />
        </div>

        {/* Card action */}
        <div className="flex justify-center px-4 pb-8 pt-2">
          <button
            type="button"
            onClick={handleOpenClick}
            className="h-input-height w-[170px] rounded-[10px] border border-accent font-mono text-game-sm uppercase tracking-game-wide text-accent transition-colors hover:bg-accent/10"
            aria-haspopup={demo ? undefined : "dialog"}
          >
            Открыть
          </button>
        </div>
      </article>

      {isOpen ? (
        <MissionModal
          missionType={missionType}
          onClose={() => setIsOpen(false)}
          onLaunched={handleLaunched}
          onRdpLaunched={handleRdpLaunched}
        />
      ) : null}
    </>
  );
}
