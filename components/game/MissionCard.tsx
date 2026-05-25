'use client';

import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useEffect, useCallback } from 'react';
import type { MissionType } from '@prisma/client';
import {
  crackLaunchSchema,
  decipherLaunchSchema,
  rdpLaunchSchema,
  type CrackLaunchInput,
  type DecipherLaunchInput,
  type RdpLaunchInput,
} from '@/lib/validations/missions';

// ─── Static config per mission type ──────────────────────────────────────────

interface MissionConfig {
  label: string;
  iconSrc: string;
  iconAlt: string;
}

const MISSION_CONFIG: Record<MissionType, MissionConfig> = {
  CRACK: {
    label: 'Взломщик',
    iconSrc: '/assets/img/icon/cracker-icon.svg',
    iconAlt: 'Иконка миссии Взломщик',
  },
  DECIPHER: {
    label: 'Дешифратор',
    iconSrc: '/assets/img/icon/decoder-icon.svg',
    iconAlt: 'Иконка миссии Дешифратор',
  },
  RDP: {
    label: 'Удаленный доступ',
    iconSrc: '/assets/img/icon/remote-access-icon.svg',
    iconAlt: 'Иконка миссии Удаленный доступ',
  },
};

// ─── Shared field + button styles ────────────────────────────────────────────

const INPUT_CLASS =
  'h-input-height w-full rounded-game-lg border border-border bg-bg-input px-4 font-mono text-game-base text-content-primary placeholder:text-content-muted focus:border-border-focus focus:shadow-game-focus focus:outline-none';

const LABEL_CLASS = 'font-mono text-game-base text-content-secondary';

// Кнопка визуально активна (как в референсе), функционально подключается в Phase 11/12/14
const SUBMIT_BTN_CLASS =
  'mt-2 h-input-height w-full rounded-game-full bg-accent font-mono text-game-sm uppercase tracking-game-wide text-content-inverse';

// ─── Form: CRACK ──────────────────────────────────────────────────────────────

function CrackForm(): React.ReactElement {
  const {
    register,
    formState: { errors },
  } = useForm<CrackLaunchInput>({
    resolver: zodResolver(crackLaunchSchema),
    mode: 'onChange',
  });

  return (
    <form className="mx-auto flex w-full max-w-[420px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="crack-url" className={LABEL_CLASS}>Ссылка</label>
        <input
          {...register('url')}
          id="crack-url"
          type="url"
          aria-invalid={Boolean(errors.url)}
          className={INPUT_CLASS}
        />
        {errors.url ? (
          <p className="font-mono text-game-sm text-semantic-error" role="alert">
            {errors.url.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="crack-login" className={LABEL_CLASS}>Почта</label>
        <input
          {...register('login')}
          id="crack-login"
          type="email"
          aria-invalid={Boolean(errors.login)}
          className={INPUT_CLASS}
        />
        {errors.login ? (
          <p className="font-mono text-game-sm text-semantic-error" role="alert">
            {errors.login.message}
          </p>
        ) : null}
      </div>

      {/* Визуально активна — handler подключается в Phase 11 */}
      <button type="button" className={SUBMIT_BTN_CLASS}>
        Начать
      </button>
    </form>
  );
}

// ─── Form: DECIPHER ───────────────────────────────────────────────────────────

function DecipherForm(): React.ReactElement {
  const {
    register,
    formState: { errors },
  } = useForm<DecipherLaunchInput>({
    resolver: zodResolver(decipherLaunchSchema),
    mode: 'onChange',
  });

  return (
    <form className="mx-auto flex w-full max-w-[420px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="decipher-folderPath" className={LABEL_CLASS}>Ссылка / путь</label>
        <input
          {...register('folderPath')}
          id="decipher-folderPath"
          type="text"
          aria-invalid={Boolean(errors.folderPath)}
          className={INPUT_CLASS}
        />
        {errors.folderPath ? (
          <p className="font-mono text-game-sm text-semantic-error" role="alert">
            {errors.folderPath.message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="decipher-cipherKey" className={LABEL_CLASS}>Ключ</label>
        <input
          {...register('cipherKey')}
          id="decipher-cipherKey"
          type="text"
          aria-invalid={Boolean(errors.cipherKey)}
          className={INPUT_CLASS}
        />
        {errors.cipherKey ? (
          <p className="font-mono text-game-sm text-semantic-error" role="alert">
            {errors.cipherKey.message}
          </p>
        ) : null}
      </div>

      <button type="button" className={SUBMIT_BTN_CLASS}>
        Начать
      </button>
    </form>
  );
}

// ─── Form: RDP ────────────────────────────────────────────────────────────────

function RdpForm(): React.ReactElement {
  const {
    register,
    formState: { errors },
  } = useForm<RdpLaunchInput>({
    resolver: zodResolver(rdpLaunchSchema),
    mode: 'onChange',
  });

  return (
    <form className="mx-auto flex w-full max-w-[420px] flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="rdp-ip" className={LABEL_CLASS}>IP адрес</label>
        <input
          {...register('ip')}
          id="rdp-ip"
          type="text"
          aria-invalid={Boolean(errors.ip)}
          className={INPUT_CLASS}
        />
        {errors.ip ? (
          <p className="font-mono text-game-sm text-semantic-error" role="alert">
            {errors.ip.message}
          </p>
        ) : null}
      </div>

      <button type="button" className={SUBMIT_BTN_CLASS}>
        Начать
      </button>
    </form>
  );
}

const FORM_BY_TYPE: Record<MissionType, () => React.ReactElement> = {
  CRACK: CrackForm,
  DECIPHER: DecipherForm,
  RDP: RdpForm,
};

// ─── Modal ────────────────────────────────────────────────────────────────────

interface MissionModalProps {
  missionType: MissionType;
  onClose: () => void;
}

function MissionModal({
  missionType,
  onClose,
}: MissionModalProps): React.ReactElement {
  const config = MISSION_CONFIG[missionType];
  const FormComponent = FORM_BY_TYPE[missionType];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
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
        className="flex h-[480px] w-full max-w-[840px] animate-modal-panel flex-col rounded-game-lg border border-border bg-bg-primary shadow-game-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <Image
            src={config.iconSrc}
            alt=""
            width={20}
            height={20}
            aria-hidden="true"
          />
          <span className="font-mono text-game-sm uppercase tracking-game-wide text-accent">
            {config.label}
          </span>

          <div className="min-w-0 flex-1 overflow-hidden">
            <span
              className="block overflow-hidden whitespace-nowrap font-mono text-game-xs text-border tracking-[-0.05em]"
              aria-hidden="true"
            >
              ////////////////////////////////////////////////////////////////////
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть форму"
            className="flex size-7 items-center justify-center rounded-game-sm border border-border font-mono text-game-xs text-content-secondary transition-colors hover:border-border-strong hover:text-content-primary"
          >
            ✕
          </button>
        </div>

        {/* Modal body — форма центрирована */}
        <div className="flex flex-1 items-center justify-center px-8 py-6">
          <FormComponent />
        </div>

        {/* Modal footer */}
        <div className="flex justify-end border-t border-border px-5 py-2.5">
          <Image
            src="/assets/img/icon/info-icon.svg"
            alt="Информация"
            width={24}
            height={24}
          />
        </div>
      </div>
    </div>
  );
}

// ─── MissionCard ──────────────────────────────────────────────────────────────

interface MissionCardProps {
  missionType: MissionType;
}

export function MissionCard({
  missionType,
}: MissionCardProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const config = MISSION_CONFIG[missionType];

  return (
    <>
      <article className="flex min-h-[480px] flex-col rounded-game-xl border border-white bg-bg-primary">
        {/* Card header */}
        <div className="border-b border-white/30 px-4 pb-3 pt-4">
          <span className="font-mono text-game-lg text-accent">
            {config.label}
          </span>
        </div>

        {/* Card icon area */}
        <div className="flex flex-1 items-center justify-center p-6 [background:radial-gradient(ellipse_at_50%_50%,rgba(0,180,160,0.20)_0%,transparent_70%)]">
          <Image
            src={config.iconSrc}
            alt={config.iconAlt}
            width={170}
            height={170}
          />
        </div>

        {/* Card action */}
        <div className="flex justify-center px-4 pb-8 pt-2">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="h-input-height w-[170px] rounded-[10px] border border-accent/60 font-mono text-game-sm uppercase tracking-game-wide text-white transition-colors hover:border-accent hover:bg-accent/10"
            aria-haspopup="dialog"
          >
            Открыть
          </button>
        </div>
      </article>

      {isOpen ? (
        <MissionModal missionType={missionType} onClose={() => setIsOpen(false)} />
      ) : null}
    </>
  );
}
