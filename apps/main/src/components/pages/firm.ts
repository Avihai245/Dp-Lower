/**
 * Contact channels of the firm that the prototype hard-codes on these pages. Phone numbers, e-mail addresses and URLs are
 * never translated. The two offices' own numbers come from the content (`offices` in @dpl/i18n).
 */
export const FIRM = {
  email: 'office@lawoffice.org.il',
  /**
   * The firm's mobile line. The prototype prints it on every attorney page and lists it as "Mobile" on the contact page and as
   * the telephone of the privacy and accessibility statements, so it is the firm's number rather than a personal one.
   */
  mobile: { display: '055-978-1688', href: 'tel:+972559781688' },
  whatsapp: { display: '+972 55-278-0162', href: 'https://api.whatsapp.com/send/?phone=972552780162' },
  youtube: {
    channel: 'https://www.youtube.com/@DeckerPexLawoffice',
    thumbnail: 'https://i.ytimg.com/vi/IYQ1_m3cCMA/maxresdefault.jpg',
  },
} as const;
