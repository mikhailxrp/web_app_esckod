import { importCsvRowSchema } from '@/lib/validations/admin-keys';

export interface ParsedKeyRow {
  key: string;
  maxActivations: number;
}

function parseCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }

  cols.push(current.trim());
  return cols;
}

export function parseKeysCsv(text: string): ParsedKeyRow[] {
  const lines = text.trim().split('\n');
  const header = lines[0]?.toLowerCase() ?? '';

  if (!header.includes('key')) {
    throw new Error('Invalid CSV: missing "key" column');
  }

  const hasMaxActivations = header.includes('maxactivations');

  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line, index) => {
      const cols = parseCsvLine(line);
      const row = importCsvRowSchema.safeParse({
        key: cols[0],
        maxActivations: hasMaxActivations ? cols[1] : undefined,
      });

      if (!row.success) {
        throw new Error(`Row ${index + 2}: ${row.error.issues[0]?.message ?? 'Invalid row'}`);
      }

      return row.data;
    });
}
