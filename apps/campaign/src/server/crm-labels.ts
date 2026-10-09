import type { DocType, LeadStage, LeadStatus } from '@dpl/core';

/**
 * English labels for the `text` column of activity_log. The CRM localises by `code` (the `activity.codes.<code>` keys in
 * the admin message files) and falls back to this text, which is also what an export or a Zap step sees.
 */
export const STAGE_EN: Record<LeadStage, string> = {
  lead: 'New lead',
  account: 'Account created',
  application: 'Application in progress',
  review: 'Under review',
  filed: 'Filed with authority',
  granted: 'Granted',
};

export const STATUS_EN: Record<LeadStatus, string> = {
  enquiry: 'Enquiry',
  account_created: 'Account Created',
  application_incomplete: 'Application Incomplete',
  application_submitted: 'Application Submitted',
  under_review: 'Under Review',
  info_required: 'Additional Information Required',
  review_completed: 'Review Completed',
  contacting: 'Contacting Applicant',
};

export const DOC_EN: Record<DocType, string> = {
  birth_certificate: "Ancestor's birth certificate",
  marriage_certificates: 'Marriage certificates',
  emigration_naturalization: 'Emigration or naturalization records',
  persecution_proof: 'Proof of persecution or departure date',
  passport: 'Passport',
  family_tree: 'Family tree or written account',
  photo_id: 'Photo ID for each applicant',
  other: 'Any other supporting record',
};
