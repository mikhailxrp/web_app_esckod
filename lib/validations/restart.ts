import { z } from 'zod';

export const restartGameSchema = z.object({});
export type RestartGameInput = z.infer<typeof restartGameSchema>;
