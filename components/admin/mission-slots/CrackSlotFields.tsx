'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { MissionSlotFormValues } from './MissionSlotForm';
import { Field } from './FormField';
import { CRACK_MAX_ATTEMPTS_MIN, CRACK_MAX_ATTEMPTS_MAX } from '@/constants/missionSlotLimits';

interface CrackSlotFieldsProps {
  register: UseFormRegister<MissionSlotFormValues>;
  errors: FieldErrors<MissionSlotFormValues>;
}

export function CrackSlotFields({ register, errors }: CrackSlotFieldsProps): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="URL сайта"
        htmlFor="crack-targetUrl"
        error={errors.targetUrl?.message}
        required
      >
        <input
          {...register('targetUrl')}
          id="crack-targetUrl"
          type="url"
          placeholder="https://example.ru"
          className="input-field"
        />
      </Field>

      <Field
        label="Email"
        htmlFor="crack-targetEmail"
        error={errors.targetEmail?.message}
        required
      >
        <input
          {...register('targetEmail')}
          id="crack-targetEmail"
          type="email"
          placeholder="user@example.ru"
          className="input-field"
        />
      </Field>

      <Field
        label="Пароль результата"
        htmlFor="crack-resultPassword"
        error={errors.resultPassword?.message}
        required
      >
        <input
          {...register('resultPassword')}
          id="crack-resultPassword"
          type="text"
          className="input-field"
        />
      </Field>

      <Field
        label={`Количество попыток (${CRACK_MAX_ATTEMPTS_MIN}–${CRACK_MAX_ATTEMPTS_MAX})`}
        htmlFor="crack-crackMaxAttempts"
        error={errors.crackMaxAttempts?.message}
        required
      >
        <input
          {...register('crackMaxAttempts', { valueAsNumber: true })}
          id="crack-crackMaxAttempts"
          type="number"
          min={CRACK_MAX_ATTEMPTS_MIN}
          max={CRACK_MAX_ATTEMPTS_MAX}
          placeholder="5"
          className="input-field"
        />
      </Field>
    </div>
  );
}
