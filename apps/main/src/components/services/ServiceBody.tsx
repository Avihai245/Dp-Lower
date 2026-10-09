import type { Locale } from '@dpl/core';
import { getArticle, getMember, type Service } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Block, CardLabel, DashRows, PlainList, SANS_ROW, SERIF, SERIF_ROW, SideCard } from './parts';

/** Everything under the dark band: the explanation on the left and the sticky documents / team / reading column. */
export async function ServiceBody({ service, locale }: { service: Service; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'services' });
  const team = service.team.map((slug) => getMember(locale, slug)).filter((m) => m !== undefined);
  const related = service.related.map((slug) => getArticle(locale, slug)).filter((a) => a !== undefined);

  return (
    <div data-pad style={s('margin: 0 auto; padding: 72px clamp(20px, 4.6vw, 120px) 0')}>
      <div
        data-resp="2"
        style={s(
          'display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr); gap: clamp(28px, 5vw, 88px); align-items: start',
        )}
      >
        <div>
          {/* the first overview paragraph is the lede in the dark band */}
          {service.overview.slice(1).map((p, i) => (
            <p
              key={i}
              style={s(
                'font-size: 18px; line-height: 1.8; color: #3f4b56; margin: 0 0 20px; max-width: 66ch',
              )}
            >
              {p}
            </p>
          ))}

          <Block title={t('detail.who')} marginTop={40}>
            <DashRows items={service.who} />
          </Block>

          <Block title={t('detail.eligibility')}>
            <DashRows items={service.eligibility} />
          </Block>

          <Block title={t('detail.process')}>
            <ol role="list" style={s('list-style: none; margin: 0; padding: 0')}>
              {service.process.map((step, i) => (
                <li
                  key={i}
                  style={s(
                    'display: grid; grid-template-columns: 40px minmax(0, 1fr); gap: 14px; padding: 14px 0; border-top: 1px solid #ece6dc; align-items: baseline',
                  )}
                >
                  <span
                    aria-hidden="true"
                    style={s('font-size: 12px; font-weight: 700; letter-spacing: 0.12em; color: #a07a3c')}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span style={s('font-size: 17px; line-height: 1.55; color: #14202b')}>{step}</span>
                </li>
              ))}
            </ol>
          </Block>

          <section style={s('background: #efe9df; margin-top: 44px; padding: 30px 32px')}>
            <CardLabel color="#7a5c2c" marginBottom={12}>
              {t('detail.assist')}
            </CardLabel>
            <p style={s('font-size: 17px; line-height: 1.75; color: #14202b; margin: 0; max-width: 62ch')}>
              {service.help}
            </p>
          </section>

          {service.faq.length > 0 && (
            <Block title={t('detail.faq')} titleGap={12}>
              {service.faq.map((item, i) => (
                <div key={i} style={s('border-top: 1px solid #ece6dc; padding: 18px 0')}>
                  <h3
                    style={s(
                      `${SERIF}; font-weight: 400; font-size: 21px; line-height: 1.3; letter-spacing: normal; color: #14202b; margin: 0 0 8px`,
                    )}
                  >
                    {item.q}
                  </h3>
                  <p
                    style={s('font-size: 16px; line-height: 1.7; color: #55606b; margin: 0; max-width: 62ch')}
                  >
                    {item.a}
                  </p>
                </div>
              ))}
            </Block>
          )}
        </div>

        <aside style={s('position: sticky; top: 96px')}>
          <SideCard label={t('detail.documents')}>
            <PlainList>
              {service.documents.map((doc, i) => (
                <li
                  key={i}
                  style={s(
                    'display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 10px; padding: 9px 0; border-top: 1px solid #ece6dc; font-size: 14.5px; line-height: 1.55; color: #3f4b56',
                  )}
                >
                  <span aria-hidden="true" style={s('color: #a07a3c')}>
                    ·
                  </span>
                  <span>{doc}</span>
                </li>
              ))}
            </PlainList>
            <p style={s('font-size: 13px; line-height: 1.55; color: #736d64; margin: 14px 0 0')}>
              {t('detail.documentsNote')}
            </p>
          </SideCard>

          {team.length > 0 && (
            <SideCard label={t('detail.team')} marginTop={16}>
              <PlainList>
                {team.map((m) => (
                  <li key={m.slug}>
                    <Link href={`/team/${m.slug}`} {...x(SANS_ROW)}>
                      <span style={s('display: block; font-size: 15.5px; font-weight: 600; color: #14202b')}>
                        {m.name}
                      </span>
                      <span style={s('display: block; font-size: 13px; color: #736d64; margin-top: 2px')}>
                        {m.role}
                      </span>
                    </Link>
                  </li>
                ))}
              </PlainList>
            </SideCard>
          )}

          {related.length > 0 && (
            <SideCard label={t('detail.related')} marginTop={16}>
              <PlainList>
                {related.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/insights/${a.slug}`} {...x(SERIF_ROW, { hover: 'color: #a07a3c' })}>
                      {a.title}
                    </Link>
                  </li>
                ))}
              </PlainList>
            </SideCard>
          )}
        </aside>
      </div>
    </div>
  );
}
