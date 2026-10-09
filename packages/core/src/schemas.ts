import { z } from 'zod';
import { DOC_ALLOWED_MIME, DOC_MAX_BYTES, DOC_TYPES } from './documents';
import { applicationDataSchema } from './application';
import { digitsOf, EMAIL_RE, multiLine, oneLine } from './format';
import { LOCALES } from './locale';
import { quizAnswersSchema } from './quiz';
import { isValidTimeZone } from './timezone';

export const localeSchema = z.enum(LOCALES);
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(EMAIL_RE, 'invalid_email');
/** Free text from a form is cleaned before it is checked: no control or invisible characters (see oneLine). */
const line = (max: number, min = 0, message?: string) => z.string().transform(oneLine).pipe(z.string().min(min, message).max(max, message));
const lines = (max: number) => z.string().transform(multiLine).pipe(z.string().max(max));

export const nameSchema = line(120, 2, 'invalid_name');
export const phoneSchema = z
  .string()
  .transform(oneLine)
  .pipe(z.string().max(40).refine((v) => digitsOf(v).length >= 7, 'invalid_phone'));
export const passwordSchema = z.string().min(8, 'password_too_short').max(72, 'password_too_long');

const utmSchema = z.record(line(40), line(300)).refine((o) => Object.keys(o).length <= 12);

/** POST /api/leads: end of the eligibility questions + contact details. */
export const leadInputSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  locale: localeSchema.default('en'),
  answers: quizAnswersSchema.default({}),
  source: line(80).optional(),
  utm: utmSchema.optional(),
  consent: z.boolean().optional(),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

/** POST /api/bookings */
export const bookingInputSchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  timezone: z.string().refine(isValidTimeZone, 'invalid_timezone'),
});
export type BookingInput = z.infer<typeof bookingInputSchema>;

/** POST /api/callbacks ("Speak with an AI Advisor") */
export const callbackInputSchema = z.object({
  name: line(120).optional(),
  phone: phoneSchema,
  locale: localeSchema.default('en'),
  source: line(80).optional(),
});
export type CallbackInput = z.infer<typeof callbackInputSchema>;

/** Forms on the firm's website. The consultation form and the lead band need email + phone + consent; chat needs phone. */
const contactBase = {
  name: nameSchema,
  locale: localeSchema.default('en'),
  page: line(300).optional(),
  source: line(80).optional(),
  utm: utmSchema.optional(),
  /** honeypot: real visitors never fill it */
  website: z.string().max(0).optional(),
};
export const contactSubmissionSchema = z.discriminatedUnion('kind', [
  z.object({
    ...contactBase,
    kind: z.literal('contact'),
    email: emailSchema,
    phone: phoneSchema,
    matter: line(120).optional(),
    note: lines(4000).optional(),
    consent: z.literal(true),
  }),
  z.object({
    ...contactBase,
    kind: z.literal('lead_band'),
    email: emailSchema,
    phone: phoneSchema,
    matter: line(120).optional(),
    note: lines(4000).optional(),
    consent: z.literal(true),
  }),
  z.object({
    ...contactBase,
    kind: z.literal('chat'),
    email: emailSchema.optional().or(z.literal('').transform(() => undefined)),
    phone: phoneSchema,
    matter: line(120).optional(),
    note: lines(4000).optional(),
    consent: z.literal(true),
  }),
]);
export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>;

/** PUT /api/portal/application (autosave) */
export const applicationSaveSchema = z.object({
  data: applicationDataSchema,
  currentSection: z.number().int().min(0).max(4).optional(),
});
export type ApplicationSaveInput = z.infer<typeof applicationSaveSchema>;

/** POST /api/portal/documents/upload-url */
export const uploadRequestSchema = z.object({
  docType: z.enum(DOC_TYPES),
  fileName: z.string().trim().min(1).max(180),
  mimeType: z.enum(DOC_ALLOWED_MIME),
  size: z.number().int().positive().max(DOC_MAX_BYTES),
});
export type UploadRequest = z.infer<typeof uploadRequestSchema>;
