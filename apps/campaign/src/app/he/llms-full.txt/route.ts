import { llmsResponse } from '@/lib/llms-response';

export const dynamic = 'force-static';

/** /he/llms-full.txt: summary and the full text for AI answer engines (Hebrew). */
export function GET() {
  return llmsResponse('he', true);
}
