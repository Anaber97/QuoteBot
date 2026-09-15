export const PLAN_CODES = Object.freeze({
  CORE: 'core',
  BUSINESS: 'business',
  ENTERPRISE: 'enterprise',
});

export const FEATURES = Object.freeze({
  QUOTE_CALCULATOR: 'quote_calculator',
  QUOTE_HISTORY: 'quote_history',
  PDF_AND_EMAIL: 'pdf_and_email',
  EQUIPMENT_CALCULATOR: 'equipment_calculator',
  CLIENT_PORTALS: 'client_portals',
  GEOFENCES: 'geofences',
  CUSTOM_BRANDING: 'custom_branding',
  SUPPORT_TICKETS: 'support_tickets',
  PRIORITY_SUPPORT: 'priority_support',
});

export const PLAN_CATALOG = Object.freeze({
  [PLAN_CODES.CORE]: Object.freeze({
    name: 'Core',
    features: Object.freeze([
      FEATURES.QUOTE_CALCULATOR,
      FEATURES.QUOTE_HISTORY,
      FEATURES.PDF_AND_EMAIL,
      FEATURES.SUPPORT_TICKETS,
    ]),
    limits: Object.freeze({ locations: 1, teamMembers: 3 }),
  }),
  [PLAN_CODES.BUSINESS]: Object.freeze({
    name: 'Business',
    features: Object.freeze([
      FEATURES.QUOTE_CALCULATOR,
      FEATURES.QUOTE_HISTORY,
      FEATURES.PDF_AND_EMAIL,
      FEATURES.EQUIPMENT_CALCULATOR,
      FEATURES.CLIENT_PORTALS,
      FEATURES.GEOFENCES,
      FEATURES.SUPPORT_TICKETS,
    ]),
    limits: Object.freeze({ locations: 5, teamMembers: 12 }),
  }),
  [PLAN_CODES.ENTERPRISE]: Object.freeze({
    name: 'Enterprise',
    features: Object.freeze(Object.values(FEATURES)),
    limits: Object.freeze({ locations: null, teamMembers: null }),
  }),
});

const ACCESS_STATUSES = new Set(['trialing', 'active', 'past_due', 'comped']);

/**
 * Resolve access in one place. Until enforcement is deliberately enabled,
 * every existing company retains all features and unlimited usage.
 */
export function resolveEntitlements(subscription, { enforcementEnabled = false } = {}) {
  if (!enforcementEnabled) {
    return {
      planCode: PLAN_CODES.ENTERPRISE,
      planName: 'Legacy access',
      features: PLAN_CATALOG.enterprise.features,
      limits: PLAN_CATALOG.enterprise.limits,
      enforced: false,
      subscriptionStatus: subscription?.status || 'unconfigured',
    };
  }

  const requestedPlan = String(subscription?.plan_code || PLAN_CODES.CORE).toLowerCase();
  const hasPaidAccess = ACCESS_STATUSES.has(subscription?.status);
  const planCode = hasPaidAccess && PLAN_CATALOG[requestedPlan] ? requestedPlan : PLAN_CODES.CORE;
  const plan = PLAN_CATALOG[planCode];

  return {
    planCode,
    planName: plan.name,
    features: plan.features,
    limits: plan.limits,
    enforced: true,
    subscriptionStatus: subscription?.status || 'inactive',
  };
}

export const hasFeature = (entitlements, feature) => Boolean(entitlements?.features?.includes(feature));

export const getSupportServiceLevel = (entitlements) =>
  hasFeature(entitlements, FEATURES.PRIORITY_SUPPORT) ? 'priority' : 'standard';

export function isWithinLimit(entitlements, limitName, currentCount) {
  const limit = entitlements?.limits?.[limitName];
  return limit == null || Number(currentCount) < limit;
}
