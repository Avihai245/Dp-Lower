import { readSource, sourceFixture } from '../src/fidelity';
import { renderEmail } from '../src/render';

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
const style = (h: string) => norm(/<style>([\s\S]*?)<\/style>/.exec(h)![1]!);
for (const id of ['welcome-3', 'welcome-15', 'file-open'] as const) {
  const mine = renderEmail(id, sourceFixture(id));
  let src: string;
  try {
    src = readSource(id);
  } catch {
    console.log(id, 'no source yet');
    continue;
  }
  console.log(id, 'style equal:', style(mine.html) === style(src), '| title:', /<title>(.*?)<\/title>/.exec(src)![1], '=>', /<title>(.*?)<\/title>/.exec(mine.html)![1]);
  const head = (h: string) => norm(h.slice(0, h.indexOf('<style>')));
  console.log('  head equal:', head(mine.html) === head(src));
  if (head(mine.html) !== head(src)) console.log(head(src), '\n', head(mine.html));
}
