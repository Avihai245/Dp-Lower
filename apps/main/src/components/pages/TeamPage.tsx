import type { Locale } from '@dpl/core';
import { DEPARTMENTS, departmentOf, getContent } from '@dpl/i18n';
import { s } from '@dpl/ui';
import { getTranslations } from 'next-intl/server';
import { ALL, departmentCounts, departmentKey, initialsOf, orderedDepartments } from './team';
import { TeamDirectory, type DirectoryPerson, type DirectoryPill } from './TeamDirectory';
import { Eyebrow, H1, PageFade, Pad } from './ui';

export async function TeamPage({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'pages' });
  const { team } = getContent(locale);

  // the filter keys off the English department of the member with the same slug, never off the Hebrew `dept` strings
  const people: DirectoryPerson[] = team.map((m) => ({
    slug: m.slug,
    name: m.name,
    role: m.role,
    dept: departmentOf(m.slug),
    photo: m.photo,
    initials: initialsOf(m.name),
  }));
  const counts = departmentCounts(people.map((p) => p.dept));

  const labelOf = (dept: string) => {
    const key = `team.departments.${departmentKey(dept)}`;
    return t.has(key) ? t(key) : dept;
  };
  const pills: DirectoryPill[] = [
    {
      id: ALL,
      label: t('team.all'),
      count: people.length,
      status: t('team.status', { count: people.length }),
    },
    ...orderedDepartments(DEPARTMENTS).map((dept) => ({
      id: dept,
      label: labelOf(dept),
      count: counts[dept] ?? 0,
      status: t('team.status', { count: counts[dept] ?? 0 }),
    })),
  ];

  return (
    <PageFade>
      <Pad top={76} hero>
        <div
          data-resp="2"
          style={s(
            'display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: clamp(28px, 4vw, 72px); align-items: end; margin-bottom: 48px',
          )}
        >
          <div>
            <Eyebrow>{t('team.eyebrow')}</Eyebrow>
            <H1>{t('team.title')}</H1>
          </div>
          <p style={s('font-size: 18px; line-height: 1.75; color: #55606b; margin: 0; max-width: 56ch')}>
            {t('team.lead')}
          </p>
        </div>
        <TeamDirectory pills={pills} people={people} groupLabel={t('team.filterLabel')} />
      </Pad>
    </PageFade>
  );
}
