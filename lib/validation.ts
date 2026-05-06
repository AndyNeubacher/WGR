import { z } from 'zod';

// Schema column is Decimal(12,3) → max 999_999_999.999.
const MAX_VOLUME = 999_999_999.999;

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+([.,]\d+)?$/u, 'invalid number')
  .transform((s) => Number(s.replace(',', '.')));

const volumeNumber = z
  .number()
  .nonnegative()
  .lte(MAX_VOLUME)
  .refine((n) => Number.isFinite(n), 'must be finite');

export const verifyReadingSchema = z.object({
  serialNumber: z.string().trim().max(64).nullable().optional(),
  consumedVolume: z
    .union([volumeNumber, decimalString.pipe(volumeNumber), z.null()])
    .optional(),
  technicianNote: z.string().trim().max(2000).nullable().optional(),
  verified: z.boolean().optional(),
});

export type VerifyReadingInput = z.infer<typeof verifyReadingSchema>;
