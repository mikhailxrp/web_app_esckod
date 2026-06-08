'use client';

import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { MissionSlotFormValues } from './MissionSlotForm';
import { Field } from './FormField';
import type { ActiveRdpSlot } from '@/types/admin-mission-slots';

interface DecipherSlotFieldsProps {
  register: UseFormRegister<MissionSlotFormValues>;
  errors: FieldErrors<MissionSlotFormValues>;
  activeRdpSlots: ActiveRdpSlot[];
}

export function DecipherSlotFields({
  register,
  errors,
  activeRdpSlots,
}: DecipherSlotFieldsProps): React.ReactElement {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field
        label="Тип шифра"
        htmlFor="decipher-cipherType"
        error={errors.cipherType?.message}
        required
      >
        <select
          {...register('cipherType')}
          id="decipher-cipherType"
          className="input-field"
        >
          <option value="PLAYFAIR">Playfair</option>
          <option value="VIGENERE">Виженер</option>
        </select>
      </Field>

      <Field
        label="Зашифрованное слово"
        htmlFor="decipher-encryptedWord"
        error={errors.encryptedWord?.message}
        required
      >
        <input
          {...register('encryptedWord')}
          id="decipher-encryptedWord"
          type="text"
          className="input-field"
        />
      </Field>

      <Field
        label="Путь к папке"
        htmlFor="decipher-folderPath"
        error={errors.folderPath?.message}
        required
      >
        <input
          {...register('folderPath')}
          id="decipher-folderPath"
          type="text"
          placeholder="Папка/Подпапка"
          className="input-field"
        />
      </Field>

      <Field
        label="Ключ шифра"
        htmlFor="decipher-cipherKey"
        error={errors.cipherKey?.message}
        required
      >
        <input
          {...register('cipherKey')}
          id="decipher-cipherKey"
          type="text"
          className="input-field"
        />
      </Field>

      <Field
        label="Пароль папки"
        htmlFor="decipher-folderPassword"
        error={errors.folderPassword?.message}
        required
      >
        <input
          {...register('folderPassword')}
          id="decipher-folderPassword"
          type="text"
          className="input-field"
        />
      </Field>

      <Field
        label="Разблокирует папку RDP"
        htmlFor="decipher-unlocksRdpFolder"
        hint="Имя папки в RDP-сессии (необязательно)"
        error={errors.unlocksRdpFolder?.message}
      >
        <input
          {...register('unlocksRdpFolder')}
          id="decipher-unlocksRdpFolder"
          type="text"
          placeholder="Шантаж"
          className="input-field"
        />
      </Field>

      <Field
        label="Связанный RDP-слот"
        htmlFor="decipher-unlocksRdpSlotKey"
        hint="Слот, который открывает этот дешифратор (необязательно)"
        error={errors.unlocksRdpSlotKey?.message}
        className="sm:col-span-2"
      >
        <select
          {...register('unlocksRdpSlotKey')}
          id="decipher-unlocksRdpSlotKey"
          className="input-field"
        >
          <option value="">— не выбрано —</option>
          {activeRdpSlots.map((slot) => (
            <option key={slot.slotKey} value={slot.slotKey}>
              {slot.displayName} ({slot.slotKey})
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
