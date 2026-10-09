import { applicationSaveSchema } from '@dpl/core';
import { handle, json, parseJson } from '@dpl/db/http';
import { requirePortalWrite } from '@/server/portal';
import { saveApplication } from '@/server/portal-application';

export const dynamic = 'force-dynamic';

/** PUT /api/portal/application: autosave. Merges the posted fields into the application and remembers the section. */
export const PUT = handle(async (req) => {
  const { db, lead } = await requirePortalWrite(req, 'application', { windowSeconds: 60, max: 120 });
  const input = await parseJson(req, applicationSaveSchema);
  const result = await saveApplication(db, lead, input);
  return json({ ok: true, sectionsDone: result.sectionsDone, complete: result.complete });
});
