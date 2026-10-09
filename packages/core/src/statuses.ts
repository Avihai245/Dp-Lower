export const LEAD_ROUTES = ['germany', 'austria', 'both', 'unsure'] as const;
export type LeadRoute = (typeof LEAD_ROUTES)[number];

/** The six columns of the CRM board / the "case stages" of the lead detail page. */
export const LEAD_STAGES = ['lead', 'account', 'application', 'review', 'filed', 'granted'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

/** Applicant-facing status, shown in the portal and set by the team. */
export const LEAD_STATUSES = [
  'enquiry',
  'account_created',
  'application_incomplete',
  'application_submitted',
  'under_review',
  'info_required',
  'review_completed',
  'contacting',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

/** The statuses the team can pick in "Status shown to the applicant" (changing it emails the applicant). */
export const APPLICANT_STATUS_OPTIONS = [
  'application_submitted',
  'under_review',
  'info_required',
  'review_completed',
  'contacting',
] as const satisfies readonly LeadStatus[];

export const stageIndex = (s: LeadStage): number => LEAD_STAGES.indexOf(s);

export type LifecycleEvent = 'account_created' | 'application_started' | 'application_submitted';

const EVENT_STAGE: Record<LifecycleEvent, LeadStage> = {
  account_created: 'account',
  application_started: 'application',
  application_submitted: 'review',
};

const EVENT_STATUS: Record<LifecycleEvent, LeadStatus> = {
  account_created: 'account_created',
  application_started: 'application_incomplete',
  application_submitted: 'application_submitted',
};

/** Automatic transitions only ever move a case forward, so a manual move by the team is never undone. */
export function advanceStage(current: LeadStage, event: LifecycleEvent): LeadStage {
  const target = EVENT_STAGE[event];
  return stageIndex(target) > stageIndex(current) ? target : current;
}

/** The status an automatic event sets, unless the case is already further along. */
export function advanceStatus(current: LeadStatus, event: LifecycleEvent): LeadStatus {
  const order: LeadStatus[] = ['enquiry', 'account_created', 'application_incomplete', 'application_submitted'];
  const cur = order.indexOf(current);
  const next = order.indexOf(EVENT_STATUS[event]);
  // statuses set by the team (under_review, info_required, ...) are never overwritten by automation
  if (cur === -1) return current;
  return next > cur ? EVENT_STATUS[event] : current;
}

export type NextActionCode =
  | 'send_portal_invite'
  | 'send_reminder'
  | 'send_document_reminder'
  | 'move_to_review'
  | 'assign_to_me'
  | 'send_status_update'
  | 'send_closing_email';

/** "Next action" card in the CRM: the one thing to do for this lead now. */
export function nextAction(stage: LeadStage, missingDocs: number): NextActionCode {
  switch (stage) {
    case 'lead':
      return 'send_portal_invite';
    case 'account':
      return 'send_reminder';
    case 'application':
      return missingDocs > 0 ? 'send_document_reminder' : 'move_to_review';
    case 'review':
      return 'assign_to_me';
    case 'filed':
      return 'send_status_update';
    case 'granted':
      return 'send_closing_email';
  }
}

export type WaitingOn = 'nothing' | 'portal' | 'application' | 'documents' | 'applicant';

export function waitingOn(l: {
  stage: LeadStage;
  status: LeadStatus;
  missingDocs: number;
  applicationComplete: boolean;
}): WaitingOn {
  if (l.status === 'info_required') return 'applicant';
  switch (l.stage) {
    case 'lead':
      return 'portal';
    case 'account':
      return 'application';
    case 'application':
      return l.missingDocs > 0 ? 'documents' : l.applicationComplete ? 'nothing' : 'application';
    default:
      return 'nothing';
  }
}

/** Flags a case in the CRM as "needs attention". */
export function needsAttention(l: {
  stage: LeadStage;
  status: LeadStatus;
  stageSince: Date;
  now: Date;
  hasRejectedDoc: boolean;
}): boolean {
  if (l.stage === 'granted') return false;
  if (l.hasRejectedDoc || l.status === 'info_required') return true;
  const days = (l.now.getTime() - l.stageSince.getTime()) / 86_400_000;
  return l.stage === 'review' ? days >= 5 : l.stage === 'filed' ? false : days >= 7;
}
