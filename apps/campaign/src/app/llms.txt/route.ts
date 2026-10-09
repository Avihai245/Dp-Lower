import { llmsResponse } from '@/lib/llms-response';

export const dynamic = 'force-static';

/** /llms.txt: summary and link index for AI answer engines (English). */
export function GET() {
  return llmsResponse('en', false);
}
