import { llmsResponse } from '@/lib/llms-response';

export const dynamic = 'force-static';

/** /llms-full.txt: summary and the full text for AI answer engines (English). */
export function GET() {
  return llmsResponse('en', true);
}
