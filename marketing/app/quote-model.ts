// Sample jobs and a simplified copy of TowCalc's pricing formula for the live quote
// on the marketing page. Distances are estimated from coordinates for a handful of
// East Texas towns; they are representative, not live routing.

type Place = { name: string; lat: number; lng: number };

const PLACES: Record<string, Place> = {
  henderson: { name: 'Henderson', lat: 32.153, lng: -94.799 },
  tyler: { name: 'Tyler', lat: 32.351, lng: -95.301 },
  longview: { name: 'Longview', lat: 32.5, lng: -94.74 },
  kilgore: { name: 'Kilgore', lat: 32.386, lng: -94.876 },
  marshall: { name: 'Marshall', lat: 32.545, lng: -94.367 },
  dallas: { name: 'Dallas', lat: 32.777, lng: -96.797 },
};

export const YARDS = [
  { id: 'henderson', name: 'Henderson yard' },
  { id: 'tyler', name: 'Tyler yard' },
  { id: 'longview', name: 'Longview yard' },
] as const;
export type YardId = typeof YARDS[number]['id'];

export type Job = {
  id: string;
  label: string;
  vehicle: string;
  pickup: string;
  dropoff: string;
  pickupAddress: string;
  dropoffAddress: string;
  rateClass: string;
  hourlyRate: number;
  loadMinutes: number;
  weightLb: number;
  widthIn: number;
};

export const JOBS: Job[] = [
  {
    id: 'sedan', label: 'Sedan', vehicle: '2019 Camry, non-running', pickup: 'kilgore', dropoff: 'tyler',
    pickupAddress: '1200 FM 2276, Kilgore', dropoffAddress: '415 S Broadway Ave, Tyler',
    rateClass: 'Light duty', hourlyRate: 125, loadMinutes: 30, weightLb: 3300, widthIn: 72,
  },
  {
    id: 'excavator', label: 'Excavator', vehicle: 'CAT 320 excavator, 112 in wide', pickup: 'longview', dropoff: 'marshall',
    pickupAddress: '3100 US-259, Longview', dropoffAddress: '2400 E End Blvd N, Marshall',
    rateClass: 'Heavy haul', hourlyRate: 200, loadMinutes: 60, weightLb: 50100, widthIn: 112,
  },
  {
    id: 'boxtruck', label: 'Box truck', vehicle: '2021 Isuzu NPR box truck', pickup: 'henderson', dropoff: 'dallas',
    pickupAddress: '600 US-79 N, Henderson', dropoffAddress: '2500 Irving Blvd, Dallas',
    rateClass: 'Medium duty', hourlyRate: 165, loadMinutes: 45, weightLb: 14500, widthIn: 96,
  },
];

const BUFFER = 0.1;
const ROUND_TO = 25;
const PERMIT_FEE = 150;

function leg(from: string, to: string) {
  const a = PLACES[from];
  const b = PLACES[to];
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  const miles = Math.max(2, Math.round(3958.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 1.25));
  const minutes = Math.max(4, Math.round((miles / (miles < 40 ? 45 : 58)) * 60));
  return { miles, minutes };
}

export function quote(job: Job, yard: YardId, afterHours = false) {
  const legs = [
    { from: `${PLACES[yard].name} yard`, to: PLACES[job.pickup].name, ...leg(yard, job.pickup), deadhead: true },
    { from: PLACES[job.pickup].name, to: PLACES[job.dropoff].name, ...leg(job.pickup, job.dropoff), deadhead: false },
    { from: PLACES[job.dropoff].name, to: `${PLACES[yard].name} yard`, ...leg(job.dropoff, yard), deadhead: true },
  ];
  const driveMinutes = legs.reduce((sum, item) => sum + item.minutes, 0);
  const hours = (driveMinutes * (1 + BUFFER) + job.loadMinutes) / 60;
  const time = hours * job.hourlyRate;
  const lines = [{ label: 'Time', detail: `${hours.toFixed(2)} h × $${job.hourlyRate}`, amount: time }];
  if (afterHours) lines.push({ label: 'After hours', detail: '+25%', amount: time * 0.25 });
  const permit = job.weightLb > 45000 || job.widthIn > 102 ? PERMIT_FEE : 0;
  if (permit) lines.push({ label: 'Oversize permit', detail: 'Texas', amount: permit });
  const total = Math.round((time * (afterHours ? 1.25 : 1) + permit) / ROUND_TO) * ROUND_TO;
  return { legs, hours, miles: legs.reduce((sum, item) => sum + item.miles, 0), lines, total };
}

/** The cheapest other yard for this job, when one would quote less. */
export function bestYard(job: Job, current: YardId, afterHours = false) {
  const here = quote(job, current, afterHours);
  const options = YARDS.filter((yard) => yard.id !== current).map((yard) => {
    const there = quote(job, yard.id, afterHours);
    const minutes = (there.legs[0].minutes + there.legs[2].minutes) - (here.legs[0].minutes + here.legs[2].minutes);
    return { ...yard, savings: here.total - there.total, minutesSaved: -Math.round(minutes * (1 + BUFFER)) };
  }).filter((yard) => yard.savings > 0).sort((a, b) => b.savings - a.savings);
  return options[0] ?? null;
}

export const money = (value: number, cents = false) =>
  value.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 });

export const duration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h} h ${String(m).padStart(2, '0')} m` : `${m} min`;
};
