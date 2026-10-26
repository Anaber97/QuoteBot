// EDIT THIS FILE to change the wording on towcalc.com: headlines, paragraphs,
// buttons, plans, prices and common questions. Keep each value inside its quotes.
// Headlines are short on purpose: each line should fit on a phone.
// The page layout lives in home.tsx; the sample jobs in the live quote live in quote-model.ts.

const CONTACT_EMAIL = 'office@towcalc.com';

export const copy = {
  contactEmail: CONTACT_EMAIL,
  demoEmail: {
    subject: 'TowCalc demo',
    body: 'Company name:\nNumber of yards:\nNumber of dispatchers:\nBest time to talk:\n',
  },
  nav: {
    leaks: 'Why TowCalc',
    setup: 'Setup',
    trust: 'Your data',
    pricing: 'Pricing',
    logIn: 'Log in',
    demo: 'Book a demo',
  },
  hero: {
    headlineLine1: 'Every call priced',
    headlineLine2: 'like you’d price it.',
    text: 'Your rates, your yards and your after-hours rules behind every quote, so dispatchers price each call the way you would, even when you’re not the one on the phone.',
    button: 'Book a 15-minute demo',
    secondary: 'Try a live quote',
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
  leaks: {
    heading: 'Where tow money leaks out',
    items: [
      { leak: 'Deadhead nobody charged.', fix: 'The drive from your yard to the pickup and back is on every quote, and TowCalc points out when another yard would run the job for less.' },
      { leak: 'After-hours at the day rate.', fix: 'Your surcharges sit on the quote where the dispatcher sees them. Removing one is a deliberate click, not something that slips.' },
      { leak: 'Two dispatchers, two prices.', fix: 'Everyone quotes from the same rates, buffers and rounding, so the same job gets the same price no matter who answers.' },
      { leak: 'Heavy work priced like a light tow.', fix: 'Truck classes and equipment weight classes carry their own rates, and oversize loads flag permits and escorts before anyone loads.' },
    ],
  },
  built: {
    heading: 'Built on a live dispatch board.',
    text: 'TowCalc started as a working dispatcher’s own tool for pricing calls on a busy board. It is built for how dispatch actually runs: a caller waiting, a truck already out, and a price that has to be right the first time.',
  },
  setup: {
    heading: 'Set up with the rates you already quote',
    steps: [
      { title: 'Enter your rates', text: 'Truck classes, hourly or per-mile rates, load time and the surcharges you already charge.' },
      { title: 'Add your yards', text: 'Every yard you dispatch from, so the drive out and back is priced from the right one.' },
      { title: 'Start quoting', text: 'Dispatchers type the pickup and drop-off, and the quote, PDF and email are ready to send.' },
    ],
    fit: [
      'Works alongside your dispatch software. Accepted jobs arrive by email with the quote PDF and BOL attached.',
      'Runs in any browser and installs on a phone, for quoting from the truck.',
      'Optional private portals let repeat customers quote themselves from your rates.',
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
    heading: 'What does one underpriced tow cost you?',
    note: 'Prices shown are provisional. Subscriptions start in early 2027.',
  },
  questions: {
    heading: 'Questions',
  },
  closing: {
    headlineLine1: 'See it with',
    headlineLine2: 'your own rates.',
    text: 'Fifteen minutes on a call: we put in one of your real jobs and price it with your rates and your yards.',
    button: 'Book a 15-minute demo',
    secondary: 'Request access',
  },
  footer: {
    tagline: 'Quoting software for towing and heavy haul',
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
    cta: 'Ask about Core',
  },
  {
    name: 'Business',
    price: '$119.99',
    period: '/ month',
    annual: 'or $1,199.99 a year',
    description: 'Everything in Core, plus the equipment calculator with permit and escort checks, private client quote portals and geofenced service areas. Up to five yards and twelve team members.',
    cta: 'Ask about Business',
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
    q: 'How long does setup take?',
    a: 'Most of it is entering the rates you already quote: truck classes, hourly or per-mile rates, surcharges and your yards. Service areas and client portals are optional and can come later.',
  },
  {
    q: 'Does it replace our dispatch software?',
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
] as const;
