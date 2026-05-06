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

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(128),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(['technician', 'manager']).default('technician'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(128).optional(),
  email: z.string().email().max(255).optional(),
  role: z.enum(['technician', 'manager']).optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1).max(255),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
});

export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

export const createSiteSchema = z.object({
  customerId: z.string().uuid(),
  name: z.string().trim().min(1).max(255),
  address: z.string().trim().max(500).nullable().optional(),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;

export const updateSiteSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  address: z.string().trim().max(500).nullable().optional(),
});

export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;

export const createGaugeSchema = z.object({
  siteId: z.string().uuid(),
  label: z.string().trim().min(1).max(255),
});

export type CreateGaugeInput = z.infer<typeof createGaugeSchema>;

export const updateGaugeSchema = z.object({
  label: z.string().trim().min(1).max(255).optional(),
});

export type UpdateGaugeInput = z.infer<typeof updateGaugeSchema>;
