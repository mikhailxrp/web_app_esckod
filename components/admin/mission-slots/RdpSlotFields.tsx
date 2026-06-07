'use client';

import type { Control, FieldErrors, UseFormRegister } from 'react-hook-form';
import { useWatch } from 'react-hook-form';
import type { MissionSlotFormValues } from './MissionSlotForm';
import { Field } from './FormField';
import type { ActiveRdpSlot } from '@/types/admin-mission-slots';
import { RDP_TIMER_SECONDS_MIN, RDP_TIMER_SECONDS_MAX } from '@/constants/missionSlotLimits';

interface RdpSlotFieldsProps {
  register: UseFormRegister<MissionSlotFormValues>;
  errors: FieldErrors<MissionSlotFormValues>;
  control: Control<MissionSlotFormValues>;
  activeRdpSlots: ActiveRdpSlot[];
}

export function RdpSlotFields({
  register,
  errors,
  control,
  activeRdpSlots,
}: RdpSlotFieldsProps): React.ReactElement {
  const rdpScenario = useWatch({ control, name: 'rdpScenario' }) as 1 | 2;
  const gridSize = rdpScenario === 1 ? 6 : 7;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="IP-адрес"
        htmlFor="rdp-correctIp"
        error={errors.correctIp?.message}
        required
      >
        <input
          {...register('correctIp')}
          id="rdp-correctIp"
          type="text"
          placeholder="192.168.1.1"
          className="input-field"
        />
      </Field>

      <Field
        label="Сценарий"
        htmlFor="rdp-rdpScenario"
        error={errors.rdpScenario?.message}
        required
      >
        <select
          {...register('rdpScenario', { valueAsNumber: true })}
          id="rdp-rdpScenario"
          className="input-field"
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
        </select>
      </Field>

      <Field
        label="Имя (история операций)"
        htmlFor="rdp-logSubjectName"
        error={errors.logSubjectName?.message}
        required
      >
        <input
          {...register('logSubjectName')}
          id="rdp-logSubjectName"
          type="text"
          placeholder="Виктор"
          className="input-field"
        />
      </Field>

      <Field
        label="Размер поля"
        htmlFor="rdp-rdpPuzzleGridSize"
      >
        <input
          id="rdp-rdpPuzzleGridSize"
          type="number"
          value={gridSize}
          readOnly
          disabled
          aria-label={`Размер поля (только для чтения): ${gridSize}`}
          className="input-field-readonly"
        />
      </Field>

      {rdpScenario === 2 && (
        <Field
          label={`Таймер (${RDP_TIMER_SECONDS_MIN}–${RDP_TIMER_SECONDS_MAX} сек)`}
          htmlFor="rdp-timerSeconds"
          error={errors.timerSeconds?.message}
          required
        >
          <input
            {...register('timerSeconds', { valueAsNumber: true })}
            id="rdp-timerSeconds"
            type="number"
            min={RDP_TIMER_SECONDS_MIN}
            max={RDP_TIMER_SECONDS_MAX}
            placeholder="120"
            className="input-field"
          />
        </Field>
      )}

      {rdpScenario === 1 && (
        <Field
          label="Следующий RDP-слот"
          htmlFor="rdp-nextRdpSlotKey"
          hint="Следующий слот, который откроется после завершения (обязательно для сценария 1)"
          error={errors.nextRdpSlotKey?.message}
          required
        >
          <select
            {...register('nextRdpSlotKey')}
            id="rdp-nextRdpSlotKey"
            className="input-field"
          >
            <option value="">— выберите слот —</option>
            {activeRdpSlots.map((slot) => (
              <option key={slot.slotKey} value={slot.slotKey}>
                {slot.displayName} ({slot.slotKey})
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}
