import { z } from 'zod';

/**
 * Zod compiles object schemas with `new Function` when it can, and finds out by trying. Both apps send a
 * Content-Security-Policy without 'unsafe-eval': zod catches the refusal, but the browser still reports it as a
 * violation (console, report-uri). In the browser, use the interpreter and skip the probe; the server keeps the JIT.
 *
 * Imported first by index.ts, so it runs before any schema is built.
 */
if (typeof window !== 'undefined') z.config({ jitless: true });
