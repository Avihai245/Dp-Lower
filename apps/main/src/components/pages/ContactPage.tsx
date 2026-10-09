import type { Locale } from '@dpl/core';
import { campaignUrl } from '@dpl/db/links';
import { getContent } from '@dpl/i18n';
import { s, x } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { ClientMessages } from '@/components/ClientMessages';
import { Ltr } from '@/components/shell/Ltr';
import { ContactForm, type MatterOption } from '../contact/ContactForm';
import { FIRM } from './firm';
import { SERIF } from './tokens';
import { Eyebrow, H1, H2Big, PageFade, Pad } from './ui';

export async function ContactPage({ locale }: { locale: Locale }) {
  const [t, forms, formsEn] = await Promise.all([
    getTranslations({ locale, namespace: 'pages' }),
    getTranslations({ locale, namespace: 'forms' }),
    getTranslations({ locale: 'en', namespace: 'forms' }),
  ]);
  const { offices } = getContent(locale);
  const telAviv = offices[0];
  if (!telAviv) throw new Error('The content has no offices');

  // the select shows the page's language and sends the English label, so the firm's CRM reads one vocabulary
  const sendValues = formsEn.raw('matters') as string[];
  const matters: MatterOption[] = (forms.raw('matters') as string[]).map((label, i) => ({
    value: sendValues[i] ?? label,
    label,
  }));

  // the client area lives in the campaign app
  const signIn = campaignUrl(`/sign-in?source=main-site${locale === 'he' ? '' : '&lang=en'}`, locale);
  const eligibility = campaignUrl(`/eligibility?source=main-site${locale === 'he' ? '' : '&lang=en'}`, locale);

  return (
    <PageFade>
      <Pad top={76} hero>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(32px, 5vw, 80px); align-items: start',
          )}
        >
          <div>
            <Eyebrow>{t('contact.eyebrow')}</Eyebrow>
            <H1 css="font-size: clamp(34px, 4vw, 56px); margin: 0 0 20px">{t('contact.title')}</H1>
            <p
              style={s(
                'font-size: 18px; line-height: 1.75; color: #55606b; margin: 0 0 40px; max-width: 52ch',
              )}
            >
              {t('contact.lead')}
            </p>

            <div style={s('border-top: 1px solid #ece6dc; padding-top: 32px')}>
              <Eyebrow as="h2" strong mb={24}>
                {t('contact.officesEyebrow')}
              </Eyebrow>
              <div
                data-resp="2"
                style={s('display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 26px')}
              >
                {offices.map((office) => (
                  <div key={office.city}>
                    <h3
                      style={s(
                        `font-family: ${SERIF}; font-size: 25px; line-height: 1.15; letter-spacing: normal; color: #14202b; margin: 0 0 12px`,
                      )}
                    >
                      {office.city}
                    </h3>
                    <p style={s('font-size: 15.5px; line-height: 1.7; color: #736d64; margin: 0 0 12px')}>
                      {office.address}
                    </p>
                    <a
                      href={office.telHref}
                      style={s('font-size: 16px; font-weight: 600; text-decoration: none')}
                    >
                      <Ltr>{office.tel}</Ltr>
                    </a>
                    <div
                      style={s(
                        'display: flex; flex-wrap: wrap; align-items: baseline; gap: 0 18px; margin-top: 6px',
                      )}
                    >
                      <span style={s('font-size: 14px; color: #736d64')}>
                        {t('contact.also')} <Ltr>{office.tel2}</Ltr>
                      </span>
                      <a href={office.map} target="_blank" rel="noopener" style={s('font-size: 14px')}>
                        {t('contact.map')}
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={s(
                'border-top: 1px solid #ece6dc; margin-top: 32px; padding-top: 32px; display: flex; flex-direction: column; gap: 12px',
              )}
            >
              <Eyebrow as="h2" strong mb={4}>
                {t('contact.otherEyebrow')}
              </Eyebrow>
              <a
                href={`mailto:${FIRM.email}`}
                style={s('align-self: flex-start; font-size: 16px; text-decoration: none')}
              >
                <Ltr>{FIRM.email}</Ltr>
              </a>
              <a
                href={FIRM.mobile.href}
                style={s('align-self: flex-start; font-size: 16px; text-decoration: none')}
              >
                {t('contact.mobile')} <Ltr>{FIRM.mobile.display}</Ltr>
              </a>
              <a
                href={FIRM.whatsapp.href}
                target="_blank"
                rel="noopener"
                style={s('align-self: flex-start; font-size: 16px; text-decoration: none')}
              >
                {t('contact.whatsapp')} <Ltr>{FIRM.whatsapp.display}</Ltr>
              </a>
              <span style={s('font-size: 15.5px; color: #736d64')}>{t('contact.hours')}</span>
              <span style={s('font-size: 15.5px; color: #736d64')}>{t('contact.languages')}</span>
            </div>
          </div>

          <div style={s('border: 1px solid #ded7ca; background: #fff; padding: clamp(24px, 3vw, 40px)')}>
            <ClientMessages namespaces={['forms']}>
              <ContactForm
                locale={locale}
                matters={matters}
                urgentTel={{ display: telAviv.tel, href: telAviv.telHref }}
              />
            </ClientMessages>
          </div>
        </div>
      </Pad>

      <Pad top={72}>
        <div style={s('border-top: 1px solid #ece6dc; padding-top: 44px')}>
          <div
            data-resp="2"
            style={s(
              'display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 4vw, 64px); align-items: center',
            )}
          >
            <div>
              <Eyebrow mb={18}>{t('contact.client.eyebrow')}</Eyebrow>
              <H2Big css="font-size: clamp(27px, 3vw, 40px); line-height: 1.12; letter-spacing: -0.015em; margin: 0 0 14px; max-width: 24ch">
                {t('contact.client.title')}
              </H2Big>
              <p style={s('font-size: 17px; line-height: 1.7; color: #736d64; margin: 0; max-width: 52ch')}>
                {t('contact.client.body')}
              </p>
            </div>
            <div style={s('display: flex; gap: 14px; flex-wrap: wrap')}>
              <a
                href={signIn}
                {...x(
                  'background: #14202b; color: #f8f5f0; text-decoration: none; font-size: 15.5px; font-weight: 700; letter-spacing: 0.05em; padding: 18px 28px; display: inline-block; transition: background 180ms ease; border-radius: 999px',
                  { hover: 'background: #22323f' },
                )}
              >
                {t('contact.client.signIn')}
              </a>
              <a
                href={eligibility}
                {...x(
                  'background: transparent; color: #14202b; text-decoration: none; border: 1px solid #14202b; font-size: 15.5px; font-weight: 600; letter-spacing: 0.05em; padding: 17px 27px; display: inline-block; transition: background 180ms ease; border-radius: 999px',
                  { hover: 'background: rgba(20,32,43,0.06)' },
                )}
              >
                {t('contact.client.eligibility')}
              </a>
            </div>
          </div>
        </div>
      </Pad>
    </PageFade>
  );
}
