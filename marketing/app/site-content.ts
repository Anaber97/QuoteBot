// EDIT THIS FILE to change the public wording or provisional pricing.
// Keep each value inside its quotes. The page layout lives in page.tsx.

export const siteContent = {
  hero: {
    eyebrow: 'Quoting software built for towing',
    headlineLine1: 'Quote faster.',
    headlineLine2: 'Stay consistent.',
    description: 'TowCalc turns your rates, equipment, service area, and business rules into a clear quoting system so your team spends less time calculating and more time moving.',
    primaryCta: 'Start quoting smarter',
    secondaryCta: 'See how it works',
    trustLeft: 'Built from real towing workflows',
    trustRight: 'Your rates. Your rules.',
  },
  proof: [
    { value: 'SECONDS', label: 'to build a quote' },
    { value: 'ONE SYSTEM', label: 'across your team' },
    { value: 'YOUR RULES', label: 'on every estimate' },
    { value: 'PRO READY', label: 'PDF & email quotes' },
  ],
  features: {
    eyebrow: 'Built for the way you quote',
    headlineLine1: 'Less guesswork.',
    headlineLine2: 'More confidence.',
    description: 'Every quote follows the same playbook without taking judgment away from the people who know your operation best.',
    cards: [
      { title: 'Your rates, built in', description: 'Configure base rates, mileage, equipment, and surcharges once. TowCalc applies them consistently to every quote.' },
      { title: 'Routes that calculate', description: 'Turn pickup and destination details into trip distance and time—ready for your pricing rules.' },
      { title: 'Quotes that look the part', description: 'Send clear, professional PDF and email quotes that give customers confidence before the truck rolls.' },
    ],
  },
  workflow: {
    eyebrow: 'From call to quote',
    headlineLine1: 'A repeatable process.',
    headlineLine2: 'Not another rigid script.',
    description: 'TowCalc gives dispatchers a reliable framework while keeping the final call where it belongs: with your team.',
    steps: [
      { title: 'Enter the job', description: 'Add pickup, destination, vehicle, and service details.' },
      { title: 'Apply your rules', description: 'TowCalc calculates distance, equipment, rates, and surcharges.' },
      { title: 'Review & send', description: 'Your dispatcher confirms the quote and sends a professional estimate.' },
    ],
  },
  portal: {
    eyebrow: 'Business plan',
    headline: 'Give approved clients a faster lane.',
    description: 'Private Client Quote Portals let approved customers build quotes using the same rates, equipment, surcharges, and service rules your company controls.',
    bullets: ['Keep pricing under your control', 'Give repeat clients self-service access', 'Reduce repetitive quote calls'],
  },
  pricing: {
    eyebrow: 'Plans that grow with you',
    headlineLine1: 'Start with what fits.',
    headlineLine2: 'Scale when you’re ready.',
    description: 'Simple plans built around how towing operations actually grow. Pricing shown is provisional and may change before launch.',
    onboardingTitle: 'Want a hand getting set up?',
    onboardingDescription: 'Guided onboarding is available for a one-time fee of $99.',
    onboardingLink: 'Learn about onboarding',
  },
  why: {
    eyebrow: 'Why TowCalc',
    headlineLine1: 'Built around towing.',
    headlineLine2: 'Not retrofitted for it.',
    description: 'Generic quoting software starts with a blank form. TowCalc starts with the realities of towing. Distance, equipment, service areas, surcharges, and the decisions your dispatchers make every day.',
    link: 'Explore the features',
    quote: 'Consistency shouldn’t mean removing the human element. It should mean giving good people a better system to work from.',
    quoteLabel: 'THE IDEA BEHIND TOWCALC',
  },
  finalCta: {
    eyebrow: 'Ready when you are',
    headlineLine1: 'Take the guesswork',
    headlineLine2: 'out of your next quote.',
    description: 'Build a faster, more consistent quoting operation with TowCalc.',
    button: 'Get started with TowCalc',
  },
  footer: {
    tagline: 'Faster, more consistent quoting for towing operations.',
    legal: '© 2026 TowCalc. All rights reserved. Pricing is provisional.',
  },
} as const;

export const pricing = {
  core: { monthly: '$29.99', annual: '$299.99' },
  business: { monthly: '$119.99', annual: '$1,199.99' },
} as const;

export const plans = [
  { name: 'Core', eyebrow: 'Run your quoting operation', description: 'For independent operators and small teams that need fast, consistent quoting.', price: pricing.core.monthly, annual: pricing.core.annual, featured: false, features: ['Tow quote calculator', 'Custom rates & surcharges', 'Quote history & records', 'Professional PDF & email quotes', '1 operating location', 'Up to 3 team members'] },
  { name: 'Business', eyebrow: 'Automate and scale', description: 'For growing towing companies with multiple clients, dispatchers, or locations.', price: pricing.business.monthly, annual: pricing.business.annual, featured: true, features: ['Everything in Core', 'Equipment Calculator', 'Private Client Quote Portals', 'Geofenced service areas', 'Up to 5 operating locations', 'Up to 12 team members'] },
  { name: 'Enterprise', eyebrow: 'Built around your operation', description: 'For larger and multi-location organizations that need a tailored rollout.', price: 'Custom', annual: 'Annual agreement', featured: false, features: ['Everything in Business', 'Tailored locations & users', 'Custom branded experience', 'Priority support', 'Configured onboarding', 'Account-specific rollout'] },
] as const;
