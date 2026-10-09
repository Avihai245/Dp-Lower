import type { TemplateDef } from '../doc';
import type { EmailTemplateId } from '../types';
import { authLink, passwordReset } from './auth';
import { bookingCancelled, bookingConfirmation } from './booking';
import { applicationReceived, documentRejected, documentRequested, statusUpdate } from './case';
import { contactReceived } from './contact';
import { fileOpen } from './file-open';
import { welcome1 } from './welcome-01';
import { welcome2 } from './welcome-02';
import { welcome3 } from './welcome-03';
import { welcome4 } from './welcome-04';
import { welcome5 } from './welcome-05';
import { welcome6 } from './welcome-06';
import { welcome7 } from './welcome-07';
import { welcome8 } from './welcome-08';
import { welcome9 } from './welcome-09';
import { welcome10 } from './welcome-10';
import { welcome11 } from './welcome-11';
import { welcome12 } from './welcome-12';
import { welcome13 } from './welcome-13';
import { welcome14 } from './welcome-14';
import { welcome15 } from './welcome-15';

/** Every template id has exactly one definition (the type makes a missing one a compile error). */
export const TEMPLATES: Record<EmailTemplateId, TemplateDef> = {
  'file-open': fileOpen,
  'booking-confirmation': bookingConfirmation,
  'booking-cancelled': bookingCancelled,
  'status-update': statusUpdate,
  'document-requested': documentRequested,
  'document-rejected': documentRejected,
  'application-received': applicationReceived,
  'password-reset': passwordReset,
  'contact-received': contactReceived,
  'auth-link': authLink,
  'welcome-1': welcome1,
  'welcome-2': welcome2,
  'welcome-3': welcome3,
  'welcome-4': welcome4,
  'welcome-5': welcome5,
  'welcome-6': welcome6,
  'welcome-7': welcome7,
  'welcome-8': welcome8,
  'welcome-9': welcome9,
  'welcome-10': welcome10,
  'welcome-11': welcome11,
  'welcome-12': welcome12,
  'welcome-13': welcome13,
  'welcome-14': welcome14,
  'welcome-15': welcome15,
};
