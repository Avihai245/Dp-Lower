import { llmsResponse } from '@/lib/llms-response';

export const dynamic = 'force-static';

/** /he/llms.txt: the Hebrew twin of /llms.txt. */
export function GET() {
  return llmsResponse('he', false);
}
