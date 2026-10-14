import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';

interface Stat {
  title: string;
  text: string;
}

/** Three plain statements on a paper-dark band under the hero. */
export async function StatStrip() {
  const t = await getTranslations('landing');
  const stats = t.raw('stats') as Stat[];
  return (
    <div style={s('background: #ece6dc')}>
      <div
        data-pad
        data-resp="3"
        style={s(
          'max-width: 100%; margin: 0 auto; padding: 66px clamp(20px, 4.6vw, 160px); display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 56px',
        )}
      >
        {stats.map((st) => (
          <div key={st.title}>
            <div
              style={s(
                "font-family: 'Newsreader', Georgia, serif; font-size: clamp(26px, 2.3vw, 34px); line-height: 1.15; color: #14202b; margin-bottom: 10px",
              )}
            >
              {st.title}
            </div>
            <div style={s('font-size: 16px; line-height: 1.6; color: #736d64; max-width: 30ch')}>
              {st.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
