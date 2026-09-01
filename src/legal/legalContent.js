export const LEGAL_BUSINESS_NAME = '[LEGAL BUSINESS NAME — OWNER TO CONFIRM]';
export const LEGAL_CONTACT_EMAIL = '[PRIVACY/LEGAL CONTACT EMAIL — OWNER TO CONFIRM]';
export const LEGAL_MAILING_ADDRESS = '[MAILING ADDRESS — OWNER TO CONFIRM]';
export const GOVERNING_STATE = '[GOVERNING STATE — OWNER TO CONFIRM]';
export const POLICY_EFFECTIVE_DATE = '[EFFECTIVE DATE — OWNER TO CONFIRM]';
export const TERMS_VERSION = '2026-09-01-draft';
export const PRIVACY_VERSION = '2026-09-01-draft';

export const legalLinks = {
  privacy: '/privacy',
  terms: '/terms',
  contact: `mailto:${LEGAL_CONTACT_EMAIL}`,
};

export const estimateDisclaimer = 'This non-binding estimate is based on the information submitted. Final pricing may change after verification of the route, vehicle, site access, permits, tolls, equipment weight and dimensions, availability, and other operating conditions.';

export const policies = {
  privacy: {
    title: 'Privacy Policy',
    version: PRIVACY_VERSION,
    intro: `Effective: ${POLICY_EFFECTIVE_DATE}. This policy explains how ${LEGAL_BUSINESS_NAME} uses information in TowCalc.`,
    sections: [
      ['Information we process', 'The application may process account identifiers, names, email addresses, phone numbers, company and client-account details, pickup and drop-off addresses, quote history, notes, equipment make, model, serial number, weight and dimensions, permit information, and uploaded bills of lading (BOLs). Account-access requests also include a company or fleet name.'],
      ['How the application uses information', 'Information is used to authenticate users, administer company workspaces and invitations, calculate and retain estimates, maintain quote and status history, support equipment searches, route jobs for operational review or dispatch, deliver quote and invitation emails, secure the service, troubleshoot errors, and respond to user requests.'],
      ['Service providers and disclosures', 'Supabase provides authentication, database, server-function, and BOL storage services. Google Maps Platform supplies places, maps, and routing; addresses and route points may be sent to Google. Vercel hosts the application and provides AI Gateway for equipment-specification searches; search text and an internal user identifier may be sent through that service to a configured model provider. Email is delivered through a Supabase function configured by the operator. Hosting and an optional operational-error webhook receive privacy-scrubbed technical events, although infrastructure providers may independently process request metadata such as IP address and device information. Information may also be disclosed when requested by the user (for example, emailing an estimate) or as required to protect the service or comply with applicable law.'],
      ['Cookies and local storage', 'Supabase authentication uses browser storage needed to maintain a signed-in session. TowCalc also stores theme preference and the dispatcher’s default base in local storage. Google Maps and other embedded services may use their own browser technologies under their policies. The repository does not show advertising cookies or cross-site behavioral advertising.'],
      ['Security and retention', `The application uses access controls, row-level database security, tenant-scoped storage paths, signed BOL links, server-held credentials, rate limits, and privacy-scrubbed monitoring. No system is completely secure. Account, quote, BOL, invite, and audit data are retained for [RETENTION PERIODS — OWNER TO CONFIRM], subject to operational, security, and legal needs. The software does not currently implement an automatic retention schedule.`],
      ['Your requests', `To request access, correction, export, or deletion of information, contact ${LEGAL_CONTACT_EMAIL} or write to ${LEGAL_MAILING_ADDRESS}. Requests may require identity and authorization verification. The exact rights and exceptions depend on applicable law; this policy does not promise rights beyond those laws.`],
      ['Children and changes', 'TowCalc is a business operations service and is not directed to children. Material policy changes should receive a new version identifier; the application is designed to record the versions accepted by each user so renewed acknowledgment can be required.'],
    ],
  },
  terms: {
    title: 'Terms of Use',
    version: TERMS_VERSION,
    intro: `Effective: ${POLICY_EFFECTIVE_DATE}. These Terms govern access to TowCalc, operated by ${LEGAL_BUSINESS_NAME}.`,
    sections: [
      ['Accounts and authorized use', 'You must provide accurate registration information, safeguard your credentials, and use only the company workspace and client data you are authorized to access. You may not interfere with the service, bypass access controls, introduce harmful code, misuse personal information, or use TowCalc unlawfully. Workspace managers are responsible for invitations and role assignments they authorize.'],
      ['Estimates—not service agreements', `${estimateDisclaimer} A displayed amount, saved estimate, emailed estimate, approval status, or BOL upload does not by itself create a binding service agreement, authorize payment, or confirm dispatch. The owner must confirm the separate contracting and dispatch process before launch.`],
      ['Equipment and route information', 'Users are responsible for checking addresses, equipment identity, weight, dimensions, attachments, access constraints, permits, and other submitted facts. Equipment search results may be incomplete or inaccurate and must be independently verified before operational use. Maps, routing, travel times, and permit indicators are informational and can change.'],
      ['Third-party services and availability', 'TowCalc depends on Supabase, Google Maps Platform, Vercel and configured email and model providers. The service may be interrupted, delayed, or changed and is provided subject to provider availability. Do not rely on it as the only record of a job or as emergency dispatch software.'],
      ['Ownership and feedback', `TowCalc and its software, branding, and content are owned by ${LEGAL_BUSINESS_NAME} or its licensors. Users retain ownership of information they submit and authorize its processing as needed to provide, secure, and support the service. [FEEDBACK LICENSE TERMS — OWNER/ATTORNEY TO CONFIRM].`],
      ['Disclaimers and liability', '[WARRANTY DISCLAIMER, LIABILITY CAP, INDEMNITY, PAYMENT TERMS, TERMINATION RIGHTS, AND ANY DISPUTE-RESOLUTION TERMS — OWNER AND U.S. ATTORNEY TO CONFIRM]. These provisions are intentionally not invented from the repository.'],
      ['Governing law and contact', `Governing law and venue: ${GOVERNING_STATE}. Legal notices: ${LEGAL_CONTACT_EMAIL}, ${LEGAL_MAILING_ADDRESS}. These fields must be completed before publication.`],
    ],
  },
};
