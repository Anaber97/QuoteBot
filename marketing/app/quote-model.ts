// Sample jobs and a simplified copy of TowCalc's pricing formula, used by the
// interactive fragments on the marketing page. Distances and times are
// representative East Texas figures, not live routing.

export type Leg = { from: string; to: string; miles: number; minutes: number };

export type Job = {
  id: string;
  label: string;
  vehicle: string;
  customer: string;
  pickup: string;
  dropoff: string;
  rateClass: 'Light duty' | 'Medium duty' | 'Heavy haul';
  hourlyRate: number;
  mileageRate: number;
  loadMinutes: number;
  weightLb: number;
  widthIn: number;
  legs: Leg[];
};

export const BASE_YARD = 'Henderson yard';

export const JOBS: Job[] = [
  {
    id: 'sedan',
    label: 'Sedan',
    vehicle: '2019 Toyota Camry, non-running',
    customer: 'Dana Whitfield',
    pickup: '1200 FM 2276, Kilgore, TX',
    dropoff: '415 S Broadway Ave, Tyler, TX',
    rateClass: 'Light duty',
    hourlyRate: 125,
    mileageRate: 4.5,
    loadMinutes: 30,
    weightLb: 3300,
    widthIn: 72,
    legs: [
      { from: BASE_YARD, to: 'Kilgore', miles: 12, minutes: 16 },
      { from: 'Kilgore', to: 'Tyler', miles: 30, minutes: 36 },
      { from: 'Tyler', to: BASE_YARD, miles: 37, minutes: 43 },
    ],
  },
  {
    id: 'excavator',
    label: 'Excavator',
    vehicle: 'CAT 320 excavator, 50,100 lb',
    customer: 'Pineywoods Site Works',
    pickup: '3100 US-259, Longview, TX',
    dropoff: '2400 E End Blvd N, Marshall, TX',
    rateClass: 'Heavy haul',
    hourlyRate: 200,
    mileageRate: 7,
    loadMinutes: 60,
    weightLb: 50100,
    widthIn: 112,
    legs: [
      { from: BASE_YARD, to: 'Longview', miles: 24, minutes: 30 },
      { from: 'Longview', to: 'Marshall', miles: 24, minutes: 28 },
      { from: 'Marshall', to: BASE_YARD, miles: 40, minutes: 50 },
    ],
  },
  {
    id: 'boxtruck',
    label: 'Box truck',
    vehicle: '2021 Isuzu NPR box truck',
    customer: 'Rusk County Moving Co.',
    pickup: '600 US-79 N, Henderson, TX',
    dropoff: '2500 Irving Blvd, Dallas, TX',
    rateClass: 'Medium duty',
    hourlyRate: 165,
    mileageRate: 5.5,
    loadMinutes: 45,
    weightLb: 14500,
    widthIn: 96,
    legs: [
      { from: BASE_YARD, to: 'Henderson', miles: 3, minutes: 6 },
      { from: 'Henderson', to: 'Dallas', miles: 125, minutes: 120 },
      { from: 'Dallas', to: BASE_YARD, miles: 125, minutes: 120 },
    ],
  },
];

export type QuoteOptions = {
  mode?: 'hourly' | 'mileage';
  afterHours?: boolean;
  zoneSurcharge?: boolean;
  widthIn?: number;
  rounding?: number;
};

export type QuoteLine = { label: string; detail?: string; amount: number };

const BUFFER = 0.1;
const PERMIT_FEE = 150;

export function escortsFor(widthIn: number) {
  if (widthIn >= 168) return { vehicles: 2, fee: 700 };
  if (widthIn >= 144) return { vehicles: 1, fee: 350 };
  return { vehicles: 0, fee: 0 };
}

export function quote(job: Job, options: QuoteOptions = {}) {
  const { mode = 'hourly', afterHours = false, zoneSurcharge = false, rounding = 25 } = options;
  const widthIn = options.widthIn ?? job.widthIn;
  const miles = job.legs.reduce((sum, leg) => sum + leg.miles, 0);
  const driveMinutes = job.legs.reduce((sum, leg) => sum + leg.minutes, 0);
  const billableHours = (driveMinutes * (1 + BUFFER) + job.loadMinutes) / 60;
  const base = mode === 'hourly' ? billableHours * job.hourlyRate : miles * job.mileageRate;

  const lines: QuoteLine[] = [
    mode === 'hourly'
      ? { label: 'Time', detail: `${billableHours.toFixed(2)} h × $${job.hourlyRate}`, amount: base }
      : { label: 'Mileage', detail: `${miles} mi × $${job.mileageRate.toFixed(2)}`, amount: base },
  ];
  let multiplier = 1;
  if (afterHours) {
    multiplier *= 1.25;
    lines.push({ label: 'After hours', detail: '+25%', amount: base * 0.25 });
  }
  if (zoneSurcharge) {
    lines.push({ label: 'Dallas core zone', detail: '+15%', amount: base * multiplier * 0.15 });
    multiplier *= 1.15;
  }
  const needsPermit = job.weightLb > 45000 || widthIn > 102;
  const permit = needsPermit ? PERMIT_FEE : 0;
  if (permit) lines.push({ label: 'Permit', detail: widthIn > 102 ? `Oversize width ${widthIn} in` : 'Overweight', amount: permit });
  const escort = escortsFor(widthIn);
  if (escort.fee) lines.push({ label: 'Escort', detail: `${escort.vehicles} vehicle${escort.vehicles > 1 ? 's' : ''}`, amount: escort.fee });

  const raw = base * multiplier + permit + escort.fee;
  const total = Math.round(raw / rounding) * rounding;
  return { miles, driveMinutes, billableHours, lines, raw, total, rounding };
}

export const money = (value: number, cents = false) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} m`;
};
