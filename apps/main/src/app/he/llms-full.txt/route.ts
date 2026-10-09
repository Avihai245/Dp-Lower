import { llmsResponse } from '@/lib/llms-response';

export const dynamic = 'force-static';

/** /he/llms-full.txt: the Hebrew twin of /llms-full.txt. */
export function GET() {
  return llmsResponse('he', true);
}
