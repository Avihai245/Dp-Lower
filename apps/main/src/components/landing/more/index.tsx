/**
 * Landing sections 10-21 (process through footer) plus the floating chat, the call-request modal and the mobile CTA bar.
 * The landing page composition imports these by name; the names and the "no props" signature are a contract.
 * Server components, except ChatWidget, AdvisorModal and MobileCta (they read useLandingUi() from ../ui-context and need
 * the `landingMore` and `funnel` message namespaces in the client provider) and the interactive leaves inside Faq,
 * VideoSection, CtaBand and FinalCta.
 */
export { Process } from './Process';
export { CtaBand } from './CtaBand';
export { TeamPhoto } from './TeamPhoto';
export { VideoSection } from './VideoSection';
export { WhyUs } from './WhyUs';
export { Fees } from './Fees';
export { Faq } from './Faq';
export { FinalCta } from './FinalCta';
export { LandingFooter } from './LandingFooter';
export { ChatWidget } from './ChatWidget';
export { AdvisorModal } from './AdvisorModal';
export { MobileCta } from './MobileCta';
