# Hebrew review checklist

All Hebrew text in this repository was written by an AI translator from the English design. The two Lead Flow documents
that came with the design are the only Hebrew written by the designer; everything else needs to be read by a
Hebrew-speaking lawyer or editor before launch. This file lists where the text lives, the terminology that was chosen
(so it can be changed in one pass) and every phrase the authors were unsure about.

## Where the Hebrew lives

| Area | Files |
|---|---|
| Firm website: interface | `apps/main/messages/he/*.json` (`site`, `home`, `pages`, `forms`, `services`, `insights`, `legal`, `seo`, `a11y`) |
| Firm website: content (22 practice areas, 37 people, 8 articles, 14 testimonials, offices) | `packages/i18n/src/he.ts` (from the design's `dpl-content-he.js`) |
| Campaign: landing, funnel, sign-in | `apps/campaign/messages/he/*.json` (`landing`, `landingMore`, `funnel`, `auth`, `privacy`, `common`) |
| Client portal | `apps/campaign/messages/he/portal.json` |
| CRM (staff only) | `apps/campaign/messages/he/admin.json` |
| Emails (15 welcome emails, the "file open" email, the transactional ones) | `packages/emails/src/templates/*.ts` (Hebrew strings sit next to the English ones) |

Every `messages/en/*.json` key has a Hebrew twin; a unit test fails if one is missing or if a placeholder differs.

## Terminology that was chosen

Change these in one search-and-replace if the firm prefers other words.

| Concept | Hebrew used | Notes |
|---|---|---|
| The firm | דקר פקס לוי | Titles and structured data: "דקר פקס לוי, משרדי עורכי דין". The design's own content file writes "דקר, פקס, לוי" once. |
| Client portal | פורטל / הפורטל (menu: פורטל לקוחות) | Follows the English, which says "portal" in the apps. The nurture emails say "personal area" in English (the design's wording) and so "האזור האישי" in Hebrew; the contact page's prose says "אזור התיק". |
| Attorney's fee | שכר הטרחה | |
| Free first conversation | ייעוץ ראשוני חינם (website), שיחת ייעוץ חינם (the booked call) | |
| "AI Advisor" | יועץ חכם | The design's Lead Flow HE says "היועץ החכם". There is no AI behind the button yet: it records a callback request. |
| Applicant (staff screens) | מבקש/ת | |
| Ancestor (a document slot) | אב קדמון | Alternatives: קרוב המשפחה, השורש המשפחתי. The form's own example is a grandmother, so the masculine generic may read oddly. |
| Case manager / handler | מנהל תיק / הגורם המטפל בתיק | |
| Register | Plural, gender-neutral (אתם / שלכם / נסו) | Used everywhere, including the quiz and the emails. |
| Quotation marks | „ ” | As in the design's Lead Flow HE. |
| Applicant statuses | פנייה חדשה, נוצר חשבון, בקשה חלקית, הבקשה הוגשה, בבדיקה, נדרש מידע נוסף (the six of Lead Flow HE); הבדיקה הושלמה, יוצרים איתכם קשר (the two the design's English adds) | The same words in the portal, the CRM and the emails (one table per place: `portal.json`, `admin.json`, `packages/emails/src/labels.ts`). |

## Phrases the authors flagged

### Firm website

- Navigation: "תובנות" (Insights), "מרכז הידע" (Knowledge center), "הכרה והוקרה" (Recognition), "לא בטוחים איזה מסלול" (Not sure which).
- "ייעוץ ראשוני חינם" is colloquial; "ללא עלות" is the formal alternative.
- Contact consent: "קראתי את מדיניות הפרטיות והסכמתי לה" (gender-neutral past tense).
- Page and form wording: "פתיחה במפות", "בקשת ייעוץ", "בקשת ייעוץ חינם", "להכיר את כל הצוות", "סיפורי לקוחות" (page title and breadcrumb: "המלצות לקוחות"), "התאריך יאושר", "בדקו את הזכאות שלכם אונליין", "מי מטפל בעניין", "שאלות נפוצות".
- The form's error, failure and captcha messages have no design original: both languages are new text.
- The 404 page title "הדף לא נמצא | דקר פקס לוי, משרדי עורכי דין" and the second office phone label "גם" (the same word on the home page and the contact page).
- The heading of the common questions in the AI-answer-engine file (`/he/llms-full.txt`): "אזרחות גרמנית ואוסטרית: שאלות נפוצות".
- Names left in Latin script: Dun's 100, BDI, Sabatier Group LLC. "WhatsApp" is written "וואטסאפ"; "Israel Bar" is "לשכת עורכי הדין".
- **Legal pages (privacy, terms, accessibility statement)** are a draft translation of draft English. A lawyer must review: ממונה על הגנת הפרטיות (Data Protection Officer), the full law names (חוק התקשורת (בזק ושידורים), התשמ"ב-1982, the accessibility regulations, חוק הגנת הפרטיות and amendment 13, section 30א of the Communications Law), אזור הלקוחות (client area), רכז נגישות (accessibility coordinator), יחסי עורך דין–לקוח (lawyer-client relationship).

### Campaign landing page and funnel

- Landing: "לאימות" (To verify) and "הנתונים יאושרו על ידי המשרד לפני ההשקה" (Figures to be confirmed by the firm before launch); "רישוי וחברויות" (Admissions and memberships); "מחקר רשומות" (Records research).
- Case study and quotes are phrased gender-neutral; the twelve reviews reuse the design's Hebrew content file and keep transliterated names; several quotes were shorter in that file than in the campaign English and the missing sentences were translated by the author (David, Emily, Rachel, Daniel, Jessica, Lauren, Andrew).
- "אחראי תיק אישי" (A named person on your case), "מומחיות שאפשר להצביע עליה" (Expertise you can point at), "האם אתם עשויים להיות זכאים?" (Could you qualify?), "המשיכו להכנת הבקשה" (Continue your application), "ערעור קונסולרי" (consular appeal).
- The chat assistant introduces itself with a masculine default ("העוזר הדיגיטלי").
- FAQ 2 says correspondence is "Hebrew or English" in Hebrew, where the English says only "English".
- The advisor window was rewritten to say what really happens (a person calls back); its Hebrew needs the firm's approval together with the legal text.
- Funnel: the note under a locked email field, "את כתובת האימייל של התיק אפשר לשנות רק בפנייה אלינו" (shown to applicants who are signed in or have a password); "זכאות" for "claim"; "שיחת ייעוץ חינם"; "לתוצאה שלי" (the button to the result); the placeholder disclaimer; the Hebrew plural form `two` in the "questions left" text (Hebrew has a dual).
- Screens the design did not have (expired link, unsubscribe, "we emailed you a link", reset copy, loading and error states): all Hebrew is new text.

### Client portal

- "סיור היכרות" (tour button), "איתור רשומות" (records research), "הגשה לרשות" (filed with authority), "תור להנפקת דרכון" (passport appointment), "יוצרים איתכם קשר" (status Contacting Applicant).
- The banner on the dashboard when the team sets a status before the application is submitted: "עדכון מהצוות שלנו: {status}".
- "האב הקדמון" (ancestor), "פרק" for a section of the form (versus "חלק"), "שושלת המשפחה", "מנהל תיק", "הגורם המטפל בתיק", "הושלם" as the generic completion label.
- Route labels "סעיף 116(2)" and "סעיף 58c" (English uses §).
- The legal wording of the persecution-proof slot ("הוכחת רדיפה או מועד העזיבה… אחרי 1933") and of the submitting screen ("מצפינים את המסמכים ומשייכים את התיק לעורך דין").

### Staff screens (CRM)

- The line after "Edit details" is saved: "נשמר. {first} מקבל/ת מייל המאשר את השינוי" (the design's "{first} gets an email confirming the change") and the longer one after an email change.
- "חשבון" (Portal, as a stage label in the "waiting on" column), "ליד" (Lead), "בהמתנה" (Waiting on, a table column), "אושר" (Granted), "הוגש לרשות" (Filed with authority), "צוות התיק" (Case team), "דרכון המבקש/ת" (Your passport, in the staff context), "עב" as the label of the language switch.

### Emails

- "אימות" for legalisation, "פקיד קבלה" for intake clerk, "בחו״ל" for abroad.
- The status labels (בבדיקה, נדרש מידע נוסף, יוצרים איתכם קשר and the others).
- **Welcome 15, single-route versions** (Germany only, Austria only) were derived by the author from the combined source text in both languages: subject, preheader, kicker, headline and the paragraphs are not verbatim.
- **details-changed** (the confirmation after staff edit the contact details, and the shorter notice to the old address after an email change, which has no link and does not name the new address): English and Hebrew are the author's.
- The English of the nine transactional emails (booking confirmed and cancelled, status update, document requested and rejected, application received, password reset, contact received, sign-in link) is also the author's: the design had no originals.
- The Hebrew has had one polish pass by the author and no native review.
