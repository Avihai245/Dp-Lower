import { llmsResponse } from '@/lib/llms-response';

export const dynamic = 'force-static';

/** /llms-full.txt: the index plus the full text of every service, article and the team (English). */
export function GET() {
  return llmsResponse('en', true);
}
