import { llmsResponse } from '@/lib/llms-response';

export const dynamic = 'force-static';

/** /he/llms.txt: summary and link index for AI answer engines (Hebrew). */
export function GET() {
  return llmsResponse('he', false);
}
