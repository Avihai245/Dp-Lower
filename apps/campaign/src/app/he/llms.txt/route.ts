import { isBilingual } from '@/lib/bilingual';
import { llmsResponse } from '@/lib/llms-response';

export const dynamic = 'force-static';

/** /he/llms.txt: summary and link index for AI answer engines (Hebrew). */
export function GET() {
  // English only (the default): there is no Hebrew edition, the English file is the one
  if (!isBilingual()) return new Response(null, { status: 308, headers: { Location: '/llms.txt' } });
  return llmsResponse('he', false);
}
