// EDIT THIS FILE to change the wording on towcalc.com: headlines, paragraphs,
// buttons, plans, prices and common questions. Keep each value inside its quotes.
// Headlines are short on purpose: each line should fit on a phone.
// The page layout lives in home.tsx; the sample jobs in the live quote live in quote-model.ts.

export const copy = {
  nav: {
    features: 'How it works',
    trust: 'Your data',
    pricing: 'Pricing',
    questions: 'Questions',
    logIn: 'Log in',
    requestAccess: 'Request access',
  },
  hero: {
    headlineLine1: 'Same job.',
    headlineLine2: 'Same price.',
    text: 'TowCalc turns your rates, yards and service areas into a quote in seconds, so every dispatcher prices every call the same way.',
    button: 'Request access',
    secondary: 'Try the quote →',
  },
  demo: {
    label: 'Live quote · try it',
    yardLabel: 'Dispatching from',
    afterHours: 'After-hours call',
    switchYard: 'Quote from',
    wouldQuote: 'would quote',
    less: 'less',
    footnote: 'Sample jobs and East Texas distances. Your quotes use live Google routing and your own rates.',
  },
  features: {
    heading: 'Built for the way towing is priced',
    items: [
      {
        title: 'Deadhead, priced every time',
        text: 'The drive out and back is on every quote, and TowCalc points out when another yard would run the job for less.',
      },
      {
        title: 'Zones and permits handle themselves',
        text: 'Draw a service area and give it a surcharge, a flat rate or a ceiling. Oversize loads are checked against each state on the route.',
      },
      {
        title: 'Send it however they want it',
        text: 'A branded PDF, an email, a dispatch request with the bill of lading attached, or a private portal where your clients quote themselves.',
      },
    ],
  },
  trust: {
    heading: 'Your rates stay yours.',
    text: 'You are trusting us with the numbers your business runs on. That is the first thing we built around.',
    points: [
      'Every company has its own workspace, walled off at the database level.',
      'Client accounts see only their own quotes, never your rate sheet.',
      'Your rates are used for one thing: your quotes.',
    ],
  },
  pricing: {
    heading: 'Pricing',
    note: 'Early access is open now. Subscriptions start in early 2027; prices shown are provisional.',
  },
  questions: {
    heading: 'Questions',
  },
  closing: {
    headlineLine1: 'Bring your rates.',
    headlineLine2: 'We’ll do the math.',
    text: 'Tell us about your company and we’ll set up your workspace with your rates, yards and service areas.',
    button: 'Request access',
  },
  footer: {
    tagline: 'Quoting software for towing and heavy haul',
    email: 'office@towcalc.com',
    copyright: '© 2026 TowCalc',
  },
} as const;

export const plans = [
  {
    name: 'Core',
    price: '$29.99',
    period: '/ month',
    annual: 'or $299.99 a year',
    description: 'The quote calculator with your rates and surcharges, quote history, and branded PDF and email quotes. One yard and up to three team members.',
    cta: 'Request Core access',
  },
  {
    name: 'Business',
    price: '$119.99',
    period: '/ month',
    annual: 'or $1,199.99 a year',
    description: 'Everything in Core, plus the equipment calculator with permit and escort checks, private client quote portals and geofenced service areas. Up to five yards and twelve team members.',
    cta: 'Request Business access',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    annual: 'Annual agreement',
    description: 'Everything in Business, with your own branding throughout, the yards and users you need, configured onboarding and a priority support queue.',
    cta: 'Talk to us',
  },
] as const;

export const faqs = [
  {
    q: 'Who can see our rates?',
    a: 'Your team, and nobody else. Each company’s workspace is isolated at the database level, and client accounts see only their own quotes. Your rates are used to calculate your quotes and for nothing else.',
  },
  {
    q: 'Is TowCalc a dispatch system?',
    a: 'No. It prices the job and hands it off. Dispatch requests arrive by email with the quote PDF and any bill of lading attached, and your team takes it from there.',
  },
  {
    q: 'Where do the miles come from?',
    a: 'Google Maps routing with live traffic, measured from your yard to the pickup, on to the drop-off and back, so deadhead is always priced.',
  },
  {
    q: 'Can my customers quote themselves?',
    a: 'Yes, on Business. Each approved client gets a private portal priced from your rates. Heavy loads over your threshold come to you for approval first.',
  },
  {
    q: 'How does it handle oversize loads?',
    a: 'Enter the weight and dimensions and TowCalc checks them against each state on the route, flags permits and escorts, and adds your costs. Confirm requirements with each state before the move.',
  },
  {
    q: 'When can we subscribe?',
    a: 'Subscriptions start in early 2027. Until then, access is by request and early companies help decide what ships next.',
  },
] as const;
