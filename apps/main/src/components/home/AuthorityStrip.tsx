import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';

/** The gold rule under the hero and the five figures about the firm. */
export async function AuthorityStrip() {
  const t = await getTranslations('home');
  const items = t.raw('authority') as Array<{ value: string; label: string }>;

  return (
    <>
      <div style={s('height: 2px; background: #a07a3c')} />
      <div style={s('background: #efe9df; border-bottom: 1px solid #ded7ca')}>
        <div data-pad style={s('margin: 0 auto; padding: 0 clamp(20px, 4.6vw, 120px)')}>
          <div data-strip style={s('display: grid; grid-template-columns: repeat(5, minmax(0, 1fr))')}>
            {items.map((a, i) => (
              <div key={a.value} style={s(`padding: 30px 26px 30px ${i === 0 ? '0' : '26px'}; border-left: ${i === 0 ? '0' : '1px solid #d3c8b6'}`)}>
                <div
                  style={s("font-family: 'Newsreader', Georgia, serif; font-size: clamp(26px, 2.4vw, 36px); line-height: 1; letter-spacing: -0.02em; color: #14202b")}
                >
                  <bdi dir="ltr">{a.value}</bdi>
                </div>
                <div style={s('font-size: 13.5px; line-height: 1.45; color: #55606b; margin-top: 8px; max-width: 24ch')}>{a.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
