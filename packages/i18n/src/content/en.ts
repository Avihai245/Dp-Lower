// Generated from the design handoff (dpl-content.js). Edit here; slugs are identical in en.ts and he.ts.
import type { Article, Office, Service, TeamMember, Testimonial } from './types';


export const services: Service[] = [
  {
    slug: "german-citizenship", group: "passports", name: "German citizenship", short: "Germany",
    kicker: "Citizenship by descent", note: "Art. 116(2) and StAG §5", online: true, dept: "Austria and Germany Department",
    headline: "German citizenship for the descendants of those who lost it.",
    overview: [
      "Germany restores citizenship to people who were deprived of it between 1933 and 1945 on political, racial or religious grounds, and to their descendants. In 2020 and again in August 2021, with the Fourth Amendment to the Nationality Act, the rules were widened so that descendants who had been excluded under the older provisions can now apply.",
      "Decker Pex Levi was among the first firms in Israel to obtain German passports for descendants of persecuted Jews under the updated law. The Austria and Germany Department, headed by Attorney Shira Gray, handles the file from the first eligibility check to the passport."
    ],
    who: ["Children, grandchildren and great-grandchildren of German Jews who emigrated or were stripped of citizenship during the Nazi era", "Descendants excluded under the older rules because the German line passed through the mother, or through a parent who lost citizenship by marriage", "Families with partial or no records who need the archival research done for them"],
    eligibility: ["Article 116(2) of the Basic Law: restoration for former German citizens deprived of citizenship between 30 January 1933 and 8 May 1945, and for their descendants", "Section 5 of the Nationality Act (StAG §5): a declaration route for descendants who did not acquire citizenship at birth because of earlier gender-discriminatory rules", "Section 15 of the Nationality Act: naturalisation for people who lost or never acquired German citizenship because of persecution, including those who gave it up or were denied it"],
    documents: ["Birth, marriage and death records for each generation in the line", "Evidence of the ancestor's German citizenship or residence before emigration", "Evidence of persecution or emigration between 1933 and 1945", "The applicant's current passport and civil-status documents", "Certified translations into German where the authority requires them"],
    process: ["Free eligibility assessment by an attorney", "Mapping the family line and identifying which provision applies", "Locating records in German civil registries and state archives, and in Israeli archives", "Certified translations and legalisation", "Filing with the Federal Office of Administration or the German embassy", "Follow-up until the certificate of citizenship and the passport are issued"],
    help: "We handle document acquisition, translation, filing and correspondence, and accompany the client until they hold the passport. Where the family has nothing in hand, our archival research specialists and genealogist reconstruct the record.",
    faq: [
      { q: "My grandmother was German. Does the line have to be through my father?", a: "No. The 2021 amendment removed the older gender-based exclusions, so a maternal line now qualifies under StAG §5." },
      { q: "We have no documents at all. Is it still worth asking?", a: "Yes. German civil registries kept duplicates and state archives hold emigration files. Finding those is part of what we do." },
      { q: "Do I have to give up my current citizenship?", a: "Restoration under Article 116(2) does not require it. Whether your own country permits dual nationality is a separate question we will answer." }
    ],
    related: ["german-citizenship-jewish-descent", "german-citizenship-grandparent"], team: ["shira-gray", "maria-chernin-dekel", "adi-berger", "reut-aharoni"]
  },
  {
    slug: "austrian-citizenship", group: "passports", name: "Austrian citizenship", short: "Austria",
    kicker: "Citizenship by descent", note: "Section 58c", online: true, dept: "Austria and Germany Department",
    headline: "Austrian citizenship for the descendants of those who fled.",
    overview: [
      "Since September 2020, Section 58c of the Austrian Nationality Act allows the descendants of people who left Austria before 15 May 1955 because of persecution by the Nazi regime, or who feared it, to acquire Austrian citizenship by declaration. Existing citizenship does not have to be given up.",
      "The applicant must prove descent from the persecuted ancestor and the ancestor's residence in Austria at the time. Our Austria and Germany Department has filed these declarations since the provision came into force."
    ],
    who: ["Children, grandchildren and later descendants of Austrian citizens or residents who emigrated because of persecution", "Descendants of people who were stateless or citizens of a successor state of the Austro-Hungarian Monarchy and lived in Austria", "Families whose Austrian records are scattered across Vienna, the provinces and the emigration files"],
    eligibility: ["Descent from an ancestor who lived in Austria and left before 15 May 1955 because of, or in fear of, persecution", "The declaration is filed with the competent Austrian representation abroad", "No residence or language requirement, and no requirement to renounce existing citizenship"],
    documents: ["Civil-status records connecting the applicant to the ancestor", "Proof of the ancestor's residence in Austria", "Evidence of emigration or persecution", "The applicant's current identity documents", "Certified translations into German"],
    process: ["Free eligibility assessment", "Family-line mapping and records research in Austrian archives", "Translation and legalisation", "Declaration filed with the Austrian embassy or consulate", "Confirmation of citizenship, then the passport"],
    help: "The persecution evidence and the descent chain are the heart of the file. We assemble both, translate them, and correspond with the Austrian authority on your behalf until the passport is issued.",
    faq: [
      { q: "My ancestor left Vienna in 1938 for Palestine. Does that qualify?", a: "Emigration in that period because of persecution is exactly what Section 58c addresses. The records will need to show residence and departure." },
      { q: "Can my children apply with me?", a: "Yes. Descendants of the same ancestor each file their own declaration, and we handle them together." }
    ],
    related: ["german-citizenship-jewish-descent"], team: ["shira-gray", "maria-chernin-dekel", "caroline-hassid", "yael-cohen"]
  },
  {
    slug: "polish-citizenship", group: "passports", name: "Polish citizenship", short: "Poland",
    kicker: "Citizenship by descent", note: "Confirmed from pre-war records", online: false, dept: "Foreign citizenship team",
    headline: "Polish citizenship, confirmed generation by generation.",
    overview: ["Polish citizenship passes by descent. Where an ancestor held Polish citizenship and did not lose it under the law in force at the time, their descendants can apply to have their own citizenship confirmed. The work is documentary: each link in the line has to be evidenced from Polish and Israeli records.", "Our foreign citizenship team assesses the line first and tells you plainly whether a confirmation is realistic before any work begins."],
    who: ["Descendants of Polish citizens who emigrated, including to Mandatory Palestine and Israel", "Families whose Polish records exist but are held in regional archives", "Applicants who need the Polish authority's confirmation before a passport can be issued"],
    eligibility: ["An ancestor who held Polish citizenship under the law in force at the time", "No intervening loss of citizenship under Polish law between the ancestor and the applicant", "Documentary proof of each generation in the line"],
    documents: ["Pre-war Polish civil-status or residence records for the ancestor", "Birth and marriage records for each generation", "Emigration and naturalisation records where relevant", "Certified translations into Polish"],
    process: ["Eligibility assessment", "Records research in Polish archives", "Translations and legalisation", "Application for confirmation of citizenship", "Registration of civil-status records and passport application"],
    help: "We locate the records, translate them, file the confirmation and the subsequent registrations, and follow the file to the passport.",
    faq: [{ q: "My grandfather left Poland in the 1930s. Did he lose citizenship?", a: "It depends on the law in force and on what he did afterwards. That is the first thing we check, and we tell you the answer before anything else is done." }],
    related: [], team: ["yehonatan-desta"]
  },
  {
    slug: "portuguese-citizenship", group: "passports", name: "Portuguese citizenship", short: "Portugal",
    kicker: "Citizenship by descent", note: "Including Sephardic provisions", online: false, dept: "Foreign citizenship team",
    headline: "Portuguese citizenship by descent.",
    overview: ["Portugal recognises citizenship by descent, and has provided routes for descendants of Portuguese Sephardic Jews. Each route carries its own certification and documentary requirements, which have changed over recent years.", "We assess which route, if any, your family history supports, and prepare the file to the standard the Portuguese authority requires."],
    who: ["Children and grandchildren of Portuguese citizens", "Descendants of Portuguese Sephardic communities with a documented connection", "Families seeking a European Union passport through a Portuguese line"],
    eligibility: ["A Portuguese parent or grandparent, or a documented Sephardic connection under the relevant provisions", "Certification and documentation as required by the route in force"],
    documents: ["Civil-status records for the line", "Certification from a recognised community where the Sephardic route applies", "Criminal-record certificates and identity documents", "Certified translations into Portuguese"],
    process: ["Eligibility assessment", "Records and certification", "Translations and legalisation", "Filing with the Portuguese authority", "Follow-up to the citizenship record and passport"],
    help: "The requirements for these routes have moved in recent years. We tell you what applies today, assemble the file, and correspond with the authority on your behalf.",
    faq: [], related: [], team: ["yehonatan-desta"]
  },
  {
    slug: "romanian-citizenship", group: "passports", name: "Romanian citizenship", short: "Romania",
    kicker: "Citizenship by descent", note: "Interwar territories", online: false, dept: "Foreign citizenship team",
    headline: "Romanian citizenship for the descendants of former citizens.",
    overview: ["Romania allows former citizens who lost citizenship against their will, and their descendants, to reacquire it. This includes descendants of people from territories that were part of Romania in the interwar period.", "Applications are filed with the Romanian National Authority for Citizenship, and the documentary standard is exacting."],
    who: ["Descendants of Romanian citizens who emigrated", "Families from Bessarabia, Bukovina and other interwar Romanian territories", "Applicants who need a full documentary chain reconstructed"],
    eligibility: ["An ancestor who held Romanian citizenship and lost it other than by voluntary renunciation", "Documentary proof of descent to the applicant"],
    documents: ["Romanian or regional civil-status records for the ancestor", "Records for each generation", "Identity documents and criminal-record certificates", "Certified translations into Romanian"],
    process: ["Eligibility assessment", "Records research", "Translation and legalisation", "Filing with the National Authority for Citizenship", "Oath and passport"],
    help: "We reconstruct the chain of records, prepare the file, and follow it through the Romanian authority.",
    faq: [], related: [], team: ["yehonatan-desta"]
  },
  {
    slug: "french-citizenship", group: "passports", name: "French citizenship", short: "France",
    kicker: "Citizenship by descent", note: "Parent or grandparent line", online: false, dept: "Foreign citizenship team",
    headline: "French citizenship through a French parent or ancestor.",
    overview: ["French nationality passes by descent from a French parent. Where the line is longer, or where the ancestor's own nationality has to be established, the file becomes a documentary exercise with the French civil-status authorities.", "Our French citizenship consultant, Jan Yaakobi, works with the team on these files."],
    who: ["Children of a French citizen, including where the parent was born abroad", "Descendants whose French line has to be evidenced across generations", "Families in Israel needing French civil-status records reconstructed"],
    eligibility: ["A French parent, or a documented French line depending on the provision relied on", "Civil-status records accepted by the French authority"],
    documents: ["Birth and marriage records for the line", "Proof of the parent's or ancestor's French nationality", "Identity documents", "Certified translations into French"],
    process: ["Assessment", "Records", "Translations", "Filing", "Certificate of nationality and passport"],
    help: "We establish the line, assemble the records, and handle the correspondence in French.",
    faq: [], related: [], team: ["jan-yaakobi"]
  },
  {
    slug: "bulgarian-citizenship", group: "passports", name: "Bulgarian citizenship", short: "Bulgaria",
    kicker: "Citizenship by descent", note: "Parent or grandparent line", online: false, dept: "Foreign citizenship team",
    headline: "Bulgarian citizenship by origin.",
    overview: ["Bulgaria grants citizenship by origin to people with at least one Bulgarian parent, and to descendants of Bulgarian citizens on proof of the line. Attorney Oded Germanov, who specialises in Bulgarian citizenship, works with Rositsa Hristova, a Bulgarian attorney, on these files."],
    who: ["Children and grandchildren of Bulgarian citizens", "Descendants of Bulgarian Jewish families who emigrated to Israel", "Applicants who need Bulgarian records located and legalised"],
    eligibility: ["A Bulgarian parent or documented Bulgarian ancestor", "Records accepted by the Bulgarian Ministry of Justice"],
    documents: ["Bulgarian civil-status or residence records", "Records for each generation", "Identity documents and criminal-record certificates", "Certified translations into Bulgarian"],
    process: ["Assessment", "Records research in Bulgaria", "Translation and legalisation", "Filing with the Ministry of Justice", "Decree and passport"],
    help: "The file is handled by an Israeli attorney and a Bulgarian attorney together, so nothing is lost between the two systems.",
    faq: [], related: [], team: ["oded-germanov", "rositsa-hristova"]
  },
  {
    slug: "acquiring-foreign-citizenship", group: "passports", name: "Acquiring foreign citizenship", short: "Foreign citizenship",
    kicker: "European and other routes", note: "Where the line is unclear", online: false, dept: "Foreign citizenship team",
    headline: "Not sure which country your family history points to? Start here.",
    overview: ["Many families know that a grandparent came from Europe but not which route, if any, that opens today. This page is the entry point for those cases. We look at the whole family history, identify which country's law could apply, and tell you plainly what is realistic.", "The firm handles German, Austrian, Polish, Portuguese, Romanian, French and Bulgarian citizenship, and can advise on other EU countries."],
    who: ["Families with a European origin and no clear route", "Applicants with possible eligibility in more than one country", "Anyone who has been told in the past that they do not qualify"],
    eligibility: ["Depends on the country and provision identified in the assessment"],
    documents: ["Whatever the family holds: names, places, dates, photographs, letters, certificates"],
    process: ["Free assessment across all routes", "Recommendation of the route with the best prospects", "Handover to the relevant department"],
    help: "One conversation covers all the routes we practise, so you do not have to work out the law before you call.",
    faq: [], related: [], team: ["yehonatan-desta", "arik-feinstein"]
  },
  {
    slug: "usa-immigration", group: "passports", name: "Immigration to the United States", short: "United States",
    kicker: "Immigration", note: "Visas and petitions", online: false, dept: "US Immigration Department",
    headline: "Visas and immigration to the United States.",
    overview: ["Decker Pex Levi is one of Israel's most experienced firms in immigration to the United States. The US Immigration Department, headed by Attorney Rebecca Mordechay with Attorney Alexandra Muller, represents individuals, families and companies in visa and petition matters.", "Cases range from family and employment petitions to investor and business routes, including files with a prior refusal."],
    who: ["Israelis relocating to the United States for work, business or family", "Companies transferring staff or opening a US presence", "Applicants who have been refused and need the refusal addressed"],
    eligibility: ["Depends on the category: family relationship, employment, investment, or other qualifying basis"],
    documents: ["Identity and civil-status records", "Evidence of the qualifying relationship, employment or investment", "Criminal-record certificates and supporting declarations"],
    process: ["Strategy consultation", "Choice of category and preparation of the petition", "Filing and correspondence with the US authority", "Consular interview preparation", "Follow-up to visa issuance"],
    help: "We prepare the petition, correspond with the US authorities, prepare you for the consular interview and stay with the file until the visa is issued.",
    faq: [], related: [], team: ["rebecca-mordechay", "alexandra-muller", "miriam-laxman"]
  },
  {
    slug: "canada-immigration", group: "passports", name: "Immigration to Canada", short: "Canada",
    kicker: "Immigration", note: "Residence routes", online: false, dept: "North America team",
    headline: "Residence and immigration routes to Canada.",
    overview: ["The firm advises on residence routes to Canada for individuals and families, and prepares the documentary file each stream requires. The North America team, led by Miriam Laxman, handles these matters."],
    who: ["Israelis and their families relocating to Canada", "Skilled workers and students", "Family members joining relatives in Canada"],
    eligibility: ["Depends on the stream: skilled work, study, family sponsorship, or other"],
    documents: ["Identity and civil-status records", "Education and employment evidence", "Language test results where required", "Criminal-record certificates"],
    process: ["Assessment of streams", "Preparation of the application", "Filing", "Follow-up"],
    help: "We assess the streams realistically, prepare the file, and correspond with the Canadian authority.",
    faq: [], related: [], team: ["miriam-laxman"]
  },

  {
    slug: "immigration-to-israel", group: "israel", name: "Immigration to Israel", short: "Immigration to Israel",
    kicker: "Status in Israel", note: "Population Authority and appeals", online: false, dept: "Immigration to Israel Department",
    headline: "Status in Israel, before the Population Authority and the courts.",
    overview: [
      "Israel's Basic Laws define it as a Jewish and democratic state, and the Law of Return gives Jews and their descendants priority in immigration. Israel is also part of the global order, and immigration is open to foreign nationals who are spouses of Israelis, asylum seekers, expert workers, volunteers, students, clergy and others. Each carries a different visa, and the procedure before the Population and Immigration Authority is rarely simple without representation.",
      "The Immigration to Israel Department, headed by Attorney Ariel Galili, represents private and commercial clients before the Population Authority offices across the country, the Appeals Tribunal, the Administrative Court and the High Court of Justice. Our attorneys have obtained rulings that set precedent on status and citizenship in Israel."
    ],
    who: ["Foreign spouses and partners of Israeli citizens and permanent residents", "Families in reunification procedures", "Foreign workers, caregivers, experts, students and volunteers", "Asylum seekers", "Elderly lone parents of Israelis, parents of lone soldiers, and descendants of the Righteous Among the Nations", "Anyone refused entry, detained by the immigration police, or facing deportation"],
    eligibility: ["The Law of Return (1950): Jews, their children and grandchildren, and their spouses", "The Citizenship Law (1952) and the Entry into Israel Law: status for spouses, family reunification, temporary and permanent residence, and naturalisation", "Population Authority procedures for each category, including 5.2.0008 for married couples and 5.2.0009 for unmarried partners", "Special procedures for elderly lone parents, parents of lone soldiers, and children and grandchildren of the Righteous Among the Nations"],
    documents: ["Passports and civil-status records", "Evidence of the relationship or the qualifying basis", "Proof of centre of life in Israel", "Criminal-record certificates from the country of origin", "Translations and authentication as the Authority requires"],
    process: ["Consultation and assessment of the right procedure", "Preparation and filing with the Population Authority office", "Attendance at hearings and interviews", "Internal appeal within 21 days of a refusal", "Appeal to the Appeals Tribunal, then the Administrative Court, and where warranted the Supreme Court or High Court of Justice"],
    help: "We prepare the file to the Authority's procedure, represent you at hearings, and appeal refusals through every instance. Over the years the firm has helped thousands of people overcome objections by the Ministry of Interior.",
    faq: [
      { q: "My application was refused. How long do I have?", a: "An internal appeal is generally filed within 21 days at the office that decided, or at the Authority's headquarters in Jerusalem. If that fails, the Appeals Tribunal is the next instance." },
      { q: "Which courts hear immigration matters?", a: "The Appeals Tribunal under the Entry into Israel Law is the first instance, with the same jurisdiction as an Administrative Court. Appeals go to the District Court sitting as an Administrative Court, and with leave to the Supreme Court. Detention is reviewed by the Detention Review Tribunal." },
      { q: "What is a graduated procedure?", a: "The staged route by which a foreign spouse moves from a B/1 permit to A/5 temporary residence and, after the required years, to permanent residence or citizenship." }
    ],
    related: ["humanitarian-visa-israel", "israel-work-visa-b1", "interior-ministry-lawyer"], team: ["ariel-galili", "joshua-pex", "maxim-rafin", "katerina-tikhonov"]
  },
  {
    slug: "aliyah", group: "israel", name: "Aliyah and the Law of Return", short: "Aliyah",
    kicker: "Status in Israel", note: "Contested files and refusals", online: false, dept: "Immigration to Israel Department",
    headline: "Aliyah under the Law of Return, including the files the Ministry contests.",
    overview: ["The Law of Return (1950) gives every Jew the right to immigrate to Israel and to receive citizenship from the day of arrival. The right extends to the child and grandchild of a Jew, to the spouse of a Jew, and to the spouse of a child or grandchild of a Jew, excluding a person who was Jewish and voluntarily changed religion. In certain cases status can be obtained for a great-grandchild of a Jew.", "Most Aliyah files are straightforward. The ones that reach us are not: questions of proof of Jewish ancestry, prior refusals, conversions, and documents from the former Soviet Union that need authentication."],
    who: ["Applicants whose eligibility the Ministry of Interior has questioned or refused", "Great-grandchildren of Jews seeking status", "Converts and families with mixed documentation", "New immigrants dealing with the Ministry after arrival"],
    eligibility: ["Jewish by birth to a Jewish mother or by conversion, not a member of another religion", "Child, grandchild or spouse as defined in the Law of Return", "Proof to the standard the Ministry of Interior applies"],
    documents: ["Birth, marriage and death records establishing the Jewish line", "Community and rabbinical documents where relevant", "Authenticated documents from the country of origin, including former Soviet records", "Criminal-record certificates"],
    process: ["Assessment of eligibility and the evidence available", "Assembly and authentication of records", "Filing with the Ministry of Interior or the Jewish Agency", "Representation at hearings", "Appeal of refusals"],
    help: "We gather the evidence the Ministry will accept, represent you at the hearing, and appeal where the refusal is wrong.",
    faq: [{ q: "Can a great-grandchild of a Jew make Aliyah?", a: "The Law of Return itself reaches the grandchild. In certain cases status in Israel can be obtained for a great-grandchild under Ministry procedure, and we have handled such files." }],
    related: [], team: ["ariel-galili", "joshua-pex"]
  },
  {
    slug: "foreign-spouse-status", group: "israel", name: "Status for a foreign spouse", short: "Foreign spouse",
    kicker: "Status in Israel", note: "The graduated procedure", online: false, dept: "Immigration to Israel Department",
    headline: "Status in Israel for the foreign spouse or partner of an Israeli.",
    overview: ["Married couples are handled under Population Authority procedure 5.2.0008: the foreign spouse receives a B/1 work permit for the first six months, then A/5 temporary residence renewed annually, and after four years may apply for citizenship or permanent residence without renouncing foreign citizenship.", "Unmarried partners, including same-sex partners, are handled under procedure 5.2.0009. Where the Israeli partner is a citizen, the procedure runs about seven years (27 months on B/1, then A/5 for a cumulative four years); where the Israeli partner is a permanent resident, about nine years. At the end the foreign partner generally receives permanent residence, with naturalisation possible under section 5 of the Citizenship Law. Married same-sex couples are treated like other married couples."],
    who: ["Foreign spouses and partners of Israeli citizens and permanent residents", "Couples whose application was refused or whose graduated procedure was stopped", "Couples where the foreign partner is abroad and must be invited to Israel", "Victims of domestic violence whose procedure was interrupted"],
    eligibility: ["A genuine relationship with an Israeli citizen or permanent resident", "Centre of life in Israel", "No security or criminal bar"],
    documents: ["Marriage certificate or evidence of a shared life", "Passports and civil-status records", "Proof of shared residence and centre of life", "Criminal-record certificate from the country of origin, authenticated", "Photographs, correspondence and declarations"],
    process: ["Consultation and assessment", "Invitation of the partner to Israel where needed", "Filing and the first interview", "Annual renewals and centre-of-life reviews", "Application for permanent status or citizenship", "Appeal where the Authority refuses or stops the procedure"],
    help: "The graduated procedure runs for years and fails on details. We prepare each stage, attend the interviews with you, and act immediately if the Authority stops the process.",
    faq: [{ q: "We are not married. Can my partner get status?", a: "Yes, under procedure 5.2.0009, though the route is longer and usually ends in permanent residence rather than citizenship." }],
    related: [], team: ["ariel-galili", "katerina-tikhonov"]
  },
  {
    slug: "visas-to-israel", group: "israel", name: "Visas to Israel", short: "Visas",
    kicker: "Status in Israel", note: "Work, expert, student, volunteer, tourist", online: false, dept: "Immigration to Israel Department",
    headline: "Every category of visa to Israel, prepared and filed.",
    overview: ["Foreign nationals need a visa for almost every purpose in Israel. Tourist visas (B/2) are not automatic for citizens of many countries and must be applied for in advance. Work visas include the B/1 for caregivers and the B/1 expert visa for specialists. Students, athletes, volunteers (B/4), clergy and staff of international humanitarian organisations each have their own category. Since 2019 US citizens investing in Israel can obtain a B/5 investor visa, and an innovation visa exists for entrepreneurs.", "We prepare the file the Ministry of Interior expects for each category, and act when a visa is refused or not renewed."],
    who: ["Employers bringing foreign experts to Israel", "Families employing foreign caregivers", "Students, volunteers, clergy and humanitarian staff", "Tourists from countries that require a visa in advance", "US investors and entrepreneurs"],
    eligibility: ["Depends on the category and the Ministry of Interior procedure for it"],
    documents: ["Passport and photographs", "Invitation or employment contract", "Evidence of qualifications or the purpose of stay", "Proof of means and of intention to leave where required", "Health insurance and criminal-record certificate where required"],
    process: ["Choice of category", "Preparation of the file", "Filing with the Population Authority or the consulate", "Follow-up and renewal", "Appeal of refusals"],
    help: "One team handles employers, families and individuals, so the file is filed once, correctly.",
    faq: [], related: ["israel-work-visa-b1"], team: ["ariel-galili", "maxim-rafin"]
  },
  {
    slug: "entry-refusal-deportation", group: "israel", name: "Entry refusal and deportation", short: "Entry refusal",
    kicker: "Status in Israel", note: "Urgent representation", online: false, dept: "Immigration to Israel Department",
    headline: "Refused at Ben Gurion, detained, or facing deportation.",
    overview: ["Israel, like every sovereign state, controls who enters. Border control officers may refuse entry on 'reasonable suspicion' under section 13 of the Entry into Israel Law, and a refusal is normally recorded and can bar entry for years. Foreign nationals without a valid visa may be detained by the immigration police and held pending deportation.", "Detention is reviewed by the Detention Review Tribunal, which must see the detainee within 96 hours and reviews continued detention at least every 30 days. Refusals of entry and deportation orders are challenged before the Appeals Tribunal, the Administrative Court and, where warranted, the Supreme Court."],
    who: ["Travellers refused entry at Ben Gurion Airport or a land crossing", "Foreign workers and asylum seekers detained by the immigration police", "Families of a detained person", "People facing a deportation order who have grounds to remain"],
    eligibility: ["Grounds to show the decision rested on wrong information or was unreasonable, or humanitarian grounds for release"],
    documents: ["Passport and the refusal or detention paperwork", "Evidence of the purpose of the visit or of ties to Israel", "Medical or humanitarian evidence where relevant"],
    process: ["Immediate contact and instructions", "Application for release on bail or deposit of a guarantee", "Representation before the Detention Review Tribunal", "Appeal to the Appeals Tribunal and onward"],
    help: "These matters move in hours. We take instructions immediately, appear before the tribunal, and pursue release and the right to enter.",
    faq: [{ q: "How long can the immigration police hold someone?", a: "The detainee must be brought before the Detention Review Tribunal within 96 hours, and continued detention is reviewed at least every 30 days. Release on bail is possible in defined circumstances." }],
    related: [], team: ["ariel-galili", "maxim-rafin"]
  },
  {
    slug: "foreign-workers-caregivers", group: "israel", name: "Foreign workers and caregivers", short: "Foreign workers",
    kicker: "Status in Israel", note: "Permits and disputes", online: false, dept: "Immigration to Israel Department",
    headline: "Permits, renewals and disputes for foreign workers and caregivers.",
    overview: ["Foreign workers in Israel hold B/1 work visas tied to a sector and often to an employer. Caregivers are the largest group, followed by experts and workers in construction and agriculture. Permits lapse, employers change, and the Ministry of Interior's decisions are not always right.", "We represent workers, families and employers in permit applications, renewals, employer changes, and in disputes and detention that follow a lapsed permit."],
    who: ["Families employing a caregiver", "Caregivers whose permit has lapsed or who need to change employer", "Employers of foreign experts and workers", "Workers detained after a permit expired"],
    eligibility: ["Depends on the sector and the permit procedure"],
    documents: ["Passport and current permit", "Employment contract", "Medical and insurance documents", "Employer authorisations"],
    process: ["Assessment", "Application or renewal", "Employer change where needed", "Representation in disputes and detention review"],
    help: "We keep the permit valid, and act quickly when it is not.",
    faq: [], related: ["israel-work-visa-b1"], team: ["ariel-galili"]
  },
  {
    slug: "asylum-seekers", group: "israel", name: "Asylum seekers and humanitarian status", short: "Asylum",
    kicker: "Status in Israel", note: "Protection and humanitarian committee", online: false, dept: "Immigration to Israel Department",
    headline: "Asylum, humanitarian status and protection from removal.",
    overview: ["More than 30,000 asylum seekers live in Israel, about 90 percent of them nationals of Sudan and Eritrea. Under international law they are entitled to temporary protection, and asylum applications must be filed while physically present in Israel under the Population Authority's procedure. Most hold temporary permits rather than residence.", "Separately, the Ministry of Interior's humanitarian committee can grant status on humanitarian or medical grounds where return would put a person at real risk. We represent applicants in both routes."],
    who: ["Asylum seekers and their children born in Israel", "People whose return home would endanger them", "Applicants to the humanitarian committee"],
    eligibility: ["A well-founded claim under the asylum procedure, or humanitarian or medical grounds recognised by the committee"],
    documents: ["Identity documents where available", "Evidence supporting the claim", "Medical evidence where relevant"],
    process: ["Consultation", "Preparation and filing of the asylum or humanitarian application", "Interview representation", "Appeal"],
    help: "These files turn on evidence and on procedure. We prepare both and represent you at every stage.",
    faq: [], related: ["humanitarian-visa-israel"], team: ["ariel-galili"]
  },
  {
    slug: "interior-ministry-representation", group: "israel", name: "Representation before the Ministry of Interior", short: "Ministry of Interior",
    kicker: "Status in Israel", note: "Hearings, appeals, tribunals", online: false, dept: "Immigration to Israel Department",
    headline: "Representation before the Population and Immigration Authority.",
    overview: ["Almost every procedure for entry, residence and status in Israel runs through the Population and Immigration Authority of the Ministry of Interior. Difficulties with clerks and offices are common and can decide a file. An experienced immigration attorney knows which documents to file, where, and how to challenge a wrong decision.", "We represent private and commercial clients before Authority offices nationwide, at hearings, in internal appeals, and before the Appeals Tribunal, the Administrative Court and the High Court of Justice, including in petitions against the legality of Ministry decisions."],
    who: ["Anyone with a pending or refused application", "People summoned to a hearing at the Ministry", "Permanent residents facing revocation or expiry of status", "Companies dealing with the Authority on behalf of staff"],
    eligibility: ["Any matter within the Authority's jurisdiction"],
    documents: ["The decision or summons, and the file so far"],
    process: ["Review of the file", "Preparation for the hearing", "Internal appeal within 21 days", "Appeal to the tribunal and the courts"],
    help: "The Authority has a duty to give reasons. We hold it to that, and to its own procedures.",
    faq: [], related: ["interior-ministry-lawyer"], team: ["ariel-galili", "joshua-pex"]
  },

  {
    slug: "notary-services", group: "other", name: "Notarial services", short: "Notary",
    kicker: "In-house", note: "Translations, affidavits, apostilles", online: false, dept: "Notarial translations",
    headline: "Notarial translations and certifications, by a notary who reads the language.",
    overview: ["A notarial translation should be made by a notary who speaks the language of the document, particularly where the document is destined for the Ministry of Interior or a foreign authority. Demand for notarial services has risen sharply as Israelis increasingly deal with authorities abroad.", "The firm's notaries certify translations, affidavits, powers of attorney and copies, and arrange apostilles. Netaly Ben-David heads the small-cases and notarial translations department."],
    who: ["Clients of the firm whose case requires certified translations", "Anyone who needs a document certified for the Ministry of Interior, a foreign consulate or a foreign court", "Individuals and companies needing an apostille"],
    eligibility: ["Any document requiring notarial certification"],
    documents: ["The original document, or a certified copy", "Identity documents of the signatory for affidavits and powers of attorney"],
    process: ["Review of the document and the receiving authority's requirements", "Translation by a notary who reads the language", "Certification, and apostille where required"],
    help: "German, English, Russian, Ukrainian, Arabic, Dutch, Spanish and Hebrew are read in-house, so translations are certified by someone who understands them.",
    faq: [{ q: "Do you translate into German for citizenship applications?", a: "Yes. If a notarial translation into German is all you need, we do that on its own." }],
    related: ["notarial-translation", "notary-jerusalem"], team: ["netaly-ben-david"]
  },
  {
    slug: "family-law-immigration", group: "other", name: "Family law and immigration", short: "Family law",
    kicker: "Where the two meet", note: "Paternity, children, spouses", online: false, dept: "Civil law",
    headline: "Family law where it meets immigration and status.",
    overview: ["Status in Israel often turns on family facts: a marriage, a partnership, a child's parentage. Registering paternity for a minor at the Ministry of Interior, obtaining status for the child of a resident and a foreign national, and dealing with the consequences of separation or domestic violence for a graduated procedure are all matters where family law and immigration law meet.", "Many of our attorneys practised civil law extensively before joining the firm, so both sides of these matters are handled under one roof."],
    who: ["Parents registering paternity or seeking status for a child", "Couples separating during a graduated procedure", "Families in reunification matters with a family-law dimension"],
    eligibility: ["Depends on the matter"],
    documents: ["Civil-status records, court orders and evidence relevant to the family facts"],
    process: ["Consultation", "Family-law proceedings where needed", "Filing with the Ministry of Interior", "Appeal where refused"],
    help: "One firm for both the family court and the Population Authority.",
    faq: [], related: [], team: ["joshua-pex"]
  },
  {
    slug: "inheritance-estates", group: "other", name: "Inheritance and estates", short: "Inheritance",
    kicker: "Civil law", note: "Wills, probate, cross-border", online: false, dept: "Civil law",
    headline: "Wills, probate and cross-border succession.",
    overview: ["The firm handles inheritance and estate matters, including wills, probate and succession orders, and estates with assets or heirs in more than one country. Where a foreign passport or foreign records are part of the family's affairs, the same team already knows the documents."],
    who: ["Heirs in Israel to estates abroad, and abroad to estates in Israel", "Anyone making a will with assets in more than one country"],
    eligibility: ["Any inheritance or estate matter"],
    documents: ["Wills, death certificates, records of assets and heirs"],
    process: ["Consultation", "Probate or succession order", "Administration and distribution"],
    help: "Cross-border estates need translations, apostilles and knowledge of two systems. We have all three in-house.",
    faq: [], related: [], team: ["meir-shua"]
  },
  {
    slug: "companies-international-business", group: "other", name: "Companies and international business", short: "Companies",
    kicker: "Commercial department", note: "Israeli and foreign companies", online: false, dept: "Commercial Department",
    headline: "Legal support for companies entering and operating in Israel.",
    overview: ["The firm represents Israeli and international companies, including businesses from the UAE and the Gulf entering the Israeli market and requiring ongoing legal assistance. Work includes bringing foreign experts to Israel, corporate and commercial matters, and the immigration side of relocating staff.", "Beyond immigration, the firm's attorneys practise commercial civil law, corporate law, intellectual property, municipal taxes and bankruptcy."],
    who: ["Foreign companies opening in Israel", "Israeli companies employing foreign experts", "Businesses relocating staff in either direction"],
    eligibility: ["Any commercial or corporate matter"],
    documents: ["Corporate documents, contracts and employee records as the matter requires"],
    process: ["Consultation", "Ongoing advice or defined engagement", "Immigration filings for staff where needed"],
    help: "The Commercial Department, with Attorneys Meir Shua and Mindy Ehrlich, works alongside the immigration teams so a company deals with one firm.",
    faq: [], related: ["employing-foreign-experts"], team: ["meir-shua", "mindy-ehrlich"]
  }
];

export const team: TeamMember[] = [
  { slug: "joshua-pex", name: "Joshua Pex", role: "Attorney · Founding Partner", dept: "Partners", kind: "partner", photo: "/images/joshua-pex.webp", linkedin: "https://www.linkedin.com/in/joshua-pex-advocate-b2b5524/",
    bio: "Joshua Pex is a founding partner of the firm and heads its immigration to Israel practice alongside the department. He writes much of the firm's published guidance on Israeli immigration law and represents clients before the Population Authority, the Appeals Tribunal and the courts. He is also the firm's link to clients around the world, and client reviews single him out as reliable, professional and providing service at the highest level." },
  { slug: "michael-decker", name: "Michael Decker", role: "Attorney · Founding Partner", dept: "Partners", kind: "partner", photo: "/images/michael-decker.webp", linkedin: "https://www.linkedin.com/in/michael-decker-3800141a5/",
    bio: "Michael Decker is a founding partner of the firm. He was among the first lawyers in Israel to develop the field of German and Austrian citizenship for descendants of persecuted Jews under the updated laws, and brings decades of experience in immigration and citizenship law across Israel and Europe." },
  { slug: "anat-levi", name: "Anat Levi", role: "Attorney · Managing Partner", dept: "Partners", kind: "partner", photo: "/images/anat-levi.webp",
    bio: "Anat Levi is the managing partner of the firm and oversees its citizenship practice. She specialises in German and Austrian citizenship by descent. Clients describe her as professional and efficient, and write about the personal attention that left them feeling their case was in good hands." },
  { slug: "shira-gray", name: "Shira Gray", role: "Attorney · Head of the Austria and Germany Department", dept: "Austria and Germany", kind: "attorney", bio: "Heads the department that files German and Austrian citizenship applications, from eligibility to passport." },
  { slug: "ariel-galili", name: "Ariel Galili", role: "Attorney · Head of the Immigration to Israel Department", dept: "Immigration to Israel", kind: "attorney", linkedin: "https://www.linkedin.com/in/ariel-galili-a0a81a19a/", bio: "Heads the department representing clients before the Population and Immigration Authority, the Appeals Tribunal and the courts." },
  { slug: "rebecca-mordechay", name: "Rebecca Mordechay", role: "Attorney · Head of the US Immigration Department", dept: "United States", kind: "attorney", linkedin: "https://www.linkedin.com/in/rebecca-mordechay-11a294212/", bio: "Heads the department handling visas and petitions to the United States for individuals, families and companies." },
  { slug: "alexandra-muller", name: "Alexandra Muller", role: "Attorney · US immigration", dept: "United States", kind: "attorney", bio: "Attorney in the US Immigration Department." },
  { slug: "maria-chernin-dekel", name: "Maria Chernin Dekel", role: "Attorney · Austria and Germany Department", dept: "Austria and Germany", kind: "attorney", bio: "Attorney in the Austria and Germany Department." },
  { slug: "adi-berger", name: "Adi Berger", role: "Attorney · Austria and Germany Department", dept: "Austria and Germany", kind: "attorney", linkedin: "https://www.linkedin.com/in/adv-adi-berger-6453761b8/", bio: "Attorney in the Austria and Germany Department." },
  { slug: "reut-aharoni", name: "Reut Aharoni", role: "Attorney · Austria and Germany Department", dept: "Austria and Germany", kind: "attorney", bio: "Attorney in the Austria and Germany Department." },
  { slug: "maxim-rafin", name: "Maxim Rafin", role: "Attorney · Immigration to Israel Department", dept: "Immigration to Israel", kind: "attorney", bio: "Attorney in the Immigration to Israel Department." },
  { slug: "katerina-tikhonov", name: "Katerina Tikhonov", role: "Attorney · Immigration to Israel Department", dept: "Immigration to Israel", kind: "attorney", bio: "Attorney in the Immigration to Israel Department." },
  { slug: "oded-germanov", name: "Oded Germanov", role: "Attorney · Bulgarian citizenship", dept: "Foreign citizenship", kind: "attorney", linkedin: "https://www.linkedin.com/in/oded-germanov-7920b234/", bio: "Attorney specialising in Bulgarian citizenship." },
  { slug: "rositsa-hristova", name: "Rositsa Hristova", role: "Foreign attorney (Bulgaria)", dept: "Foreign citizenship", kind: "attorney", linkedin: "https://www.linkedin.com/in/rositsa-hristova-7a754312a/", bio: "Bulgarian-qualified attorney working on Bulgarian citizenship files." },
  { slug: "miriam-laxman", name: "Miriam Laxman", role: "Foreign attorney (Sweden) · Head of the North America team", dept: "United States", kind: "attorney", bio: "Leads the North America team." },
  { slug: "meir-shua", name: "Meir Shua", role: "Attorney · Commercial Department", dept: "Commercial", kind: "attorney", bio: "Attorney in the Commercial Department." },
  { slug: "mindy-ehrlich", name: "Mindy Ehrlich", role: "Attorney · Commercial Department", dept: "Commercial", kind: "attorney", bio: "Attorney in the Commercial Department." },
  { slug: "jan-yaakobi", name: "Jan Yaakobi", role: "French citizenship consultant", dept: "Foreign citizenship", kind: "staff", bio: "Advises on French citizenship files." },
  { slug: "arik-feinstein", name: "Arik Feinstein", role: "Genealogist and roots researcher", dept: "Austria and Germany", kind: "staff", bio: "Reconstructs family lines from archival sources." },
  { slug: "eliran-novik", name: "Eliran Novik", role: "Archival research specialist", dept: "Austria and Germany", kind: "staff", bio: "Locates records in German and Austrian archives." },
  { slug: "ido-shkolnik", name: "Ido Shkolnik", role: "Archival research specialist", dept: "Austria and Germany", kind: "staff", bio: "Locates records in German and Austrian archives." },
  { slug: "irina-ironi", name: "Irina Ironi", role: "Project manager and team lead", dept: "Operations", kind: "staff", bio: "" },
  { slug: "caroline-hassid", name: "Caroline Hassid", role: "Case manager · Austria and Germany", dept: "Austria and Germany", kind: "staff", bio: "" },
  { slug: "yael-cohen", name: "Yael Cohen", role: "Case manager · Austria and Germany", dept: "Austria and Germany", kind: "staff", bio: "" },
  { slug: "lior-sinai", name: "Lior Sinai", role: "Case manager · Austria and Germany", dept: "Austria and Germany", kind: "staff", bio: "" },
  { slug: "lina-danon", name: "Lina Danon", role: "Case manager · Austria and Germany", dept: "Austria and Germany", kind: "staff", bio: "" },
  { slug: "chava-yaakobi", name: "Chava Yaakobi", role: "Paralegal · Austria and Germany", dept: "Austria and Germany", kind: "staff", bio: "" },
  { slug: "yehonatan-desta", name: "Yehonatan Desta", role: "Paralegal · Foreign citizenship", dept: "Foreign citizenship", kind: "staff", bio: "" },
  { slug: "netaly-ben-david", name: "Netaly Ben-David", role: "Head of small cases and notarial translations", dept: "Notarial translations", kind: "staff", bio: "" },
  { slug: "sasha-kishko", name: "Sasha Kishko", role: "Client relations manager", dept: "Client relations", kind: "staff", bio: "" },
  { slug: "michael-weinberg", name: "Michael Weinberg", role: "Client case management", dept: "Client relations", kind: "staff", bio: "" },
  { slug: "anna-zhukovsky", name: "Anna Zhukovsky", role: "Client case management", dept: "Client relations", kind: "staff", bio: "" },
  { slug: "einat-s", name: "Einat S.", role: "Client case management", dept: "Client relations", kind: "staff", bio: "" },
  { slug: "elisheva-arieh", name: "Elisheva Arieh", role: "Legal secretary", dept: "Operations", kind: "staff", bio: "" },
  { slug: "nurit-turki", name: "Nurit Turki", role: "Finance", dept: "Finance", kind: "staff", bio: "" },
  { slug: "elia-beilin", name: "Elia Beilin", role: "Bookkeeper", dept: "Finance", kind: "staff", bio: "" },
  { slug: "shai-rafael", name: "Shai Rafael", role: "Finance", dept: "Finance", kind: "staff", bio: "" }
];

export const articles: Article[] = [
  { slug: "german-citizenship-jewish-descent", title: "German citizenship by Jewish descent", date: "15 Jun 2026", cat: "German citizenship", author: "Austria and Germany Department", services: ["german-citizenship"],
    excerpt: "Before the rise of the Nazis in the 1930s, German Jews were one of the most prosperous diaspora communities. Their descendants can now reclaim the citizenship that was taken.",
    body: ["Before the rise of the Nazis in the 1930s, German Jews were one of the most prosperous diaspora communities in the world. Between 1933 and 1945 they were stripped of citizenship, driven out or murdered. Germany's Basic Law and its Nationality Act now provide routes for their descendants to reclaim what was lost.", "Article 116(2) of the Basic Law restores citizenship to those deprived of it on political, racial or religious grounds, and to their descendants. Where that provision does not reach, Sections 5 and 15 of the Nationality Act, as widened in 2021, may.", "The work is documentary. Each generation has to be shown, and the ancestor's German citizenship and persecution evidenced from records that often survive only in German archives. That is where the firm's archival specialists start."] },
  { slug: "german-citizenship-grandparent", title: "German citizenship through German Jewish grandparents", date: "6 May 2026", cat: "German citizenship", author: "Austria and Germany Department", services: ["german-citizenship"],
    excerpt: "Since August 2021 and the Fourth Amendment to the German Nationality Act, a German Jewish grandparent is a far more usable route than it was.",
    body: ["As of August 2021, with the passage of the Fourth Amendment to the German Nationality Act, it has become much easier for the grandchildren of German Jews to acquire citizenship. The amendment removed exclusions that had turned on whether the German line passed through the father or the mother, and on whether the ancestor lost citizenship by marriage or by emigration.", "A grandchild whose grandmother was German, and whose parent was born before 1975 to a German mother and a foreign father, was often excluded under the older rules. Under StAG §5 that grandchild can now declare.", "The application still requires the full chain of records. We reconstruct it from German civil registries and state archives, translate it, and file the declaration."] },
  { slug: "humanitarian-visa-israel", title: "Humanitarian visa to Israel", date: "29 Apr 2026", cat: "Immigration to Israel", author: "Immigration to Israel Department", services: ["asylum-seekers", "immigration-to-israel"],
    excerpt: "Many people ask what a humanitarian visa to Israel is. The term is widely used by the public, but the law works through the Ministry of Interior's humanitarian committee.",
    body: ["Many people ask: what is a humanitarian visa to Israel? Although the term is widely used, Israeli law does not contain a visa by that name. What exists is a procedure by which the Ministry of Interior's humanitarian committee can grant status on humanitarian or medical grounds where the applicant does not fit any ordinary category and return would put them at real risk.", "The procedure is discretionary and evidentiary. The committee looks at the whole of the applicant's circumstances, and the quality of the file decides the outcome.", "The firm represents applicants before the committee and appeals refusals."] },
  { slug: "israel-work-visa-b1", title: "Israeli work visa: the B/1 expert visa", date: "8 Sep 2026", cat: "Visas to Israel", author: "Immigration to Israel Department", services: ["visas-to-israel", "foreign-workers-caregivers", "companies-international-business"],
    excerpt: "Israeli companies increasingly rely on international talent to remain competitive. The B/1 expert visa is the route, and its procedure has rules employers should know before they start.",
    body: ["In today's globalised business environment, Israeli companies increasingly rely on international talent to remain competitive in technology, industry, healthcare and other fields. The B/1 expert visa is the permit that allows a foreign specialist to work in Israel for an Israeli employer.", "The employer applies first for a permit to employ a foreign expert, and the worker then applies for the visa. The Ministry expects evidence of the expertise, of the salary threshold, and of the need.", "Refusals and delays usually come from the file, not the law. We prepare it once, correctly, for the employer and the employee."] },
  { slug: "employing-foreign-experts", title: "Employing foreign experts in Israel", date: "29 Aug 2026", cat: "Companies", author: "Commercial Department", services: ["companies-international-business", "visas-to-israel"],
    excerpt: "Israel is a global centre of innovation, but its continued economic growth often depends on specialist knowledge that comes from abroad.",
    body: ["Israel is a global centre of innovation, but its continued economic growth often depends on specialist knowledge and technological capability that come from abroad. Employers who need that knowledge in Israel go through the foreign-expert permit procedure.", "The procedure asks for evidence that the expertise is genuine and needed, that the salary meets the threshold, and that the employer is in good standing. Each is a point where files stall.", "The Commercial Department and the Immigration to Israel Department handle these files together."] },
  { slug: "notarial-translation", title: "Notarial translation: why the translator matters", date: "13 Apr 2026", cat: "Notarial services", author: "Notarial translations", services: ["notary-services"],
    excerpt: "A notarial translation should be produced by a notary who speaks the language of the document, particularly when it is destined for the Ministry of Interior.",
    body: ["A notarial translation should be made by a notary who speaks the language of the document, particularly where the document is destined for the Ministry of Interior. The certification is only as good as the notary's understanding of what was translated.", "Authorities in Israel and abroad reject translations that are certified without that understanding. The firm's notaries read the languages they certify."] },
  { slug: "interior-ministry-lawyer", title: "Choosing a lawyer for Ministry of Interior matters", date: "14 Apr 2026", cat: "Immigration to Israel", author: "Immigration to Israel Department", services: ["interior-ministry-representation"],
    excerpt: "There are many lawyers in Israel practising in many fields. When the other side of the file is the Population and Immigration Authority, what matters is different.",
    body: ["Are you looking for a lawyer for Ministry of Interior matters? There are many lawyers in Israel practising in many fields, but immigration to Israel is a specialised area with its own procedures, tribunals and deadlines.", "A lawyer in this field knows which documents to file and where, how to prepare for a hearing, and how to appeal within 21 days when the answer is wrong. Where necessary the appeal goes on to the Appeals Tribunal, the Administrative Court and the Supreme Court."] },
  { slug: "notary-jerusalem", title: "Notaries in Jerusalem", date: "14 Jun 2026", cat: "Notarial services", author: "Notarial translations", services: ["notary-services"],
    excerpt: "Demand for notarial services has risen sharply as Israelis increasingly deal with authorities abroad.",
    body: ["The use of notarial services has risen sharply in recent years. In a global world in which Israelis increasingly deal with foreign authorities, documents have to be certified and often apostilled before they are accepted.", "The firm's Jerusalem office provides notarial translations and certifications, with an apostille arranged where the receiving authority requires it."] }
];

export const testimonials: Testimonial[] = [
  { quote: "DP Lower made a complicated process surprisingly simple. They were responsive, organized, and clear about what documents I needed at every stage. I'm very happy with the service and would absolutely recommend their team.", name: "Jason Miller", date: "27 August 2026" },
  { quote: "I contacted the firm because my grandmother was born in Germany and I had no idea whether that could make me eligible for citizenship. They explained everything clearly and helped me understand the process from the very beginning. Excellent experience.", name: "Sarah Klein", date: "5 August 2026" },
  { quote: "Professional from start to finish. The team helped me locate the documents I needed and kept me updated throughout the process. Getting my German citizenship was something I had been thinking about for years, and I'm glad I finally did it with them.", name: "David Bernstein", date: "14 July 2026" },
  { quote: "What I appreciated most was how patient everyone was. I had a lot of questions about my family history and eligibility, and I never felt rushed. They walked me through each step and made the whole experience much less intimidating.", name: "Emily Goldberg", date: "22 June 2026" },
  { quote: "Great team and very professional service. They knew exactly what was required for my Austrian citizenship case and guided me through the documentation step by step. Highly recommended.", name: "Jonathan Weiss", date: "3 June 2026" },
  { quote: "My family had very limited information about my grandfather's life in Germany, so I assumed the process would be almost impossible. They helped us understand what was missing and how to move forward. Their guidance made a huge difference.", name: "Rachel Hoffman", date: "18 May 2026" },
  { quote: "From the initial eligibility check through the documentation process, everything was clear and well organized. I always knew what stage my application was at and what was needed from me next.", name: "Daniel Friedman", date: "29 April 2026" },
  { quote: "I started looking into German citizenship mainly because I wanted my children to have more opportunities to live and study in Europe in the future. They made the process easy to understand and supported our family throughout.", name: "Jessica Stein", date: "7 April 2026" },
  { quote: "Excellent communication and very knowledgeable people. Whenever I had a question, someone was there to explain what was happening. The process took time, but I always felt that my case was being handled professionally.", name: "Robert Adler", date: "16 March 2026" },
  { quote: "I honestly expected the citizenship process to be overwhelming. It wasn't. The team broke everything down into manageable steps, helped with the documents, and kept things moving.", name: "Lauren Kaplan", date: "24 February 2026" },
  { quote: "My grandfather left Austria many years ago, and I wasn't even sure our family would qualify. They reviewed our situation, explained the process clearly, and guided us through everything that followed.", name: "Andrew Feldman", date: "2 February 2026" },
  { quote: "I began this process because I wanted my grandchildren to have the opportunity to study and build a future in Europe if they choose to. The firm was patient, kind, and extremely professional throughout. For our family, obtaining European citizenship means giving the next generation more possibilities.", name: "Barbara Levine", date: "12 January 2026" },
  { quote: "A professional and serious firm with an excellent team. Attorney Anat Levi gave me courteous, professional and efficient service. Personal attention, and every question or request was dealt with at once. I felt I was in good, professional hands.", name: "Revital Cohen Elias", date: "Google review, translated from Hebrew" },
  { quote: "A professional and businesslike firm. I came to Attorney Pex and received courteous, reliable and professional service at the highest level. Thank you.", name: "Itai Shnir", date: "Google review, translated from Hebrew" }
];

export const offices: Office[] = [
  { city: "Tel Aviv", address: "11 Menachem Begin Road, Ramat Gan. Rogovin Tidhar Tower, 25th floor. P.O.B 1213, 5268104, Israel.", tel: "03-372-4722", telHref: "tel:+97233724722", tel2: "077-470-2790", map: "https://www.google.com/maps/search/?api=1&query=11+Menachem+Begin+Road+Ramat+Gan" },
  { city: "Jerusalem", address: "10 Yad Harutzim Street, 2nd floor. P.O.B 53347, 9342148, Jerusalem, Israel.", tel: "02-381-0013", telHref: "tel:+97223810013", tel2: "02-644-7602", map: "https://www.google.com/maps/search/?api=1&query=Yad+Harutzim+10+Jerusalem" }
];
