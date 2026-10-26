// EDIT THIS FILE to change the plans, provisional prices or common questions.
// Keep each value inside its quotes. The page layout lives in home.tsx.

export const plans = [
  {
    name: 'Core',
    price: '$29.99',
    period: '/ month',
    annual: 'or $299.99 a year. Provisional pricing; subscriptions open early 2027.',
    description: 'The quote calculator with your rates and surcharges, quote history, and branded PDF and email quotes. One operating location and up to three team members.',
    cta: 'Request Core access',
  },
  {
    name: 'Business',
    price: '$119.99',
    period: '/ month',
    annual: 'or $1,199.99 a year. Provisional pricing; subscriptions open early 2027.',
    description: 'Everything in Core, plus the equipment calculator with permit and escort checks, private client quote portals and geofenced service areas. Up to five locations and twelve team members.',
    cta: 'Request Business access',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    annual: 'Annual agreement, priced to your operation.',
    description: 'Everything in Business, with your own branding throughout, the locations and users you need, configured onboarding and a priority support queue.',
    cta: 'Talk to us about Enterprise',
  },
] as const;

export const faqs = [
  {
    q: 'Is TowCalc a dispatch system?',
    a: 'No. It prices the job and hands it off. Dispatch requests arrive by email with the quote PDF and any bill of lading attached, and your team takes it from there.',
  },
  {
    q: 'Where do the miles come from?',
    a: 'Google Maps routing with live traffic, measured from your yard to the pickup, on to the drop-off and back again, so the deadhead is always priced.',
  },
  {
    q: 'Can my customers quote themselves?',
    a: 'Yes, on Business. Each approved client gets a private portal priced by weight class from your rates. Heavy loads over your threshold come to you for approval first.',
  },
  {
    q: 'How does it handle oversize loads?',
    a: 'Enter the weight and dimensions and TowCalc checks them against each state on the route, flags permits and escorts, and adds your costs. Confirm requirements with each state before the move.',
  },
  {
    q: 'Who can see our rates?',
    a: 'Only your team. Each company’s workspace is isolated at the database level, and client accounts see only their own quotes.',
  },
  {
    q: 'When can we subscribe?',
    a: 'Subscriptions open in early 2027. Until then access is by request, and early companies help decide what ships next.',
  },
] as const;
