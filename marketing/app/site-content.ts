// EDIT THIS FILE to change the wording on towcalc.com: headlines, paragraphs,
// buttons, plans, prices and common questions. Keep each value inside its quotes.
// Headlines are short on purpose: each line should fit on a phone.
// The page layout lives in home.tsx; the sample quotes it shows live in quote-model.ts.

export const copy = {
  nav: {
    product: 'Product',
    rules: 'Rules',
    pricing: 'Pricing',
    questions: 'Questions',
    logIn: 'Log in',
    requestAccess: 'Request access',
  },
  hero: {
    headlineLine1: 'Price the tow',
    headlineLine2: 'while they wait.',
    text: 'TowCalc applies your rates, zones and permit rules to every call, so each dispatcher quotes the same job the same way.',
    button: 'Request access',
  },
  showcase: {
    heading: 'One quote, sent four ways',
    text: 'Every quote becomes a branded PDF, an email your customer can forward, a dispatch request with the bill of lading attached, or a price your client builds in their own portal.',
  },
  howItWorks: {
    heading: 'From call to quote',
    steps: ['First, enter your rates once.', 'Then take the call.', 'Last, send it before they hang up.'],
  },
  photoCaption: 'A 50-ton rotator on a winter recovery. The quote was the easy part.',
  rules: {
    heading: 'Your rules, applied',
    pricingMode: {
      heading: 'Charge by the hour or by the mile.',
      text: 'Hourly quotes use drive time plus your buffer and load time. Mileage quotes use the full loop from your yard and back.',
    },
    zones: {
      heading: 'Zones charge for themselves.',
      text: 'Draw a service area on the map and give it a surcharge, a flat rate or a ceiling. Routes that pass through it pick it up automatically.',
    },
    oversize: {
      heading: 'Oversize loads flag their permits.',
      text: 'Weight and dimensions are checked against the states on the route. Permits and escorts are added at your cost before anyone loads.',
    },
    rounding: {
      heading: 'Round the way you round.',
      text: 'Every total lands on your increment, so two dispatchers never quote the same job $12 apart.',
    },
  },
  closing: {
    headlineLine1: 'Bring your rates.',
    headlineLine2: 'We do the math.',
    text: 'Tell us about your company and we’ll set up your workspace with your rates, yards and service areas.',
    button: 'Request access',
  },
  footer: {
    tagline: 'Quoting software for towing',
    email: 'office@towcalc.com',
    copyright: '© 2026 TowCalc',
  },
} as const;

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
