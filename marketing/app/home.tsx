'use client';

import { useEffect, useId, useState } from 'react';
import { BASE_YARD, JOBS, duration, escortsFor, money, quote, type Job, type QuoteOptions } from './quote-model';
import { faqs, plans } from './site-content';

const APP_URL = 'https://app.towcalc.com';
const REQUEST_URL = `${APP_URL}/?request`;

function useReveal() {
  useEffect(() => {
    document.documentElement.classList.add('js');
    const targets = document.querySelectorAll('[data-reveal], .shutter');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function QuotePanel({ job, options, children, compact = false }: { job: Job; options?: QuoteOptions; children?: React.ReactNode; compact?: boolean }) {
  const result = quote(job, options);
  return (
    <div className={`qp${compact ? ' qp-compact' : ''}`}>
      {children}
      {!compact && (
        <ol className="qp-route" aria-label="Route">
          {job.legs.map((leg, index) => (
            <li key={`${leg.from}-${leg.to}`} className={index === 0 || index === job.legs.length - 1 ? 'is-deadhead' : ''}>
              <span>{leg.from} → {leg.to}</span>
              <span className="num">{leg.miles} mi · {duration(leg.minutes)}</span>
            </li>
          ))}
        </ol>
      )}
      <dl className="qp-lines">
        {result.lines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}{line.detail && <small>{line.detail}</small>}</dt>
            <dd className="num">{money(line.amount, true)}</dd>
          </div>
        ))}
      </dl>
      <div className="qp-total">
        <div>
          <span>Quote</span>
          <small>{result.miles} mi · {duration(result.driveMinutes)} drive + 10% · rounded to ${result.rounding}</small>
        </div>
        <strong className="num" aria-live="polite">{money(result.total)}</strong>
      </div>
    </div>
  );
}

function HeroFragment() {
  const [jobId, setJobId] = useState('sedan');
  const [afterHours, setAfterHours] = useState(false);
  const job = JOBS.find((item) => item.id === jobId) ?? JOBS[0];
  return (
    <div className="ui-window" data-ui>
      <div className="ui-bar">
        <span>New quote</span>
        <span className="ui-muted">Base: {BASE_YARD}</span>
      </div>
      <div className="ui-body">
        <div className="seg" role="radiogroup" aria-label="Sample call">
          {JOBS.map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={item.id === jobId} onClick={() => setJobId(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="ui-fields">
          <label>Pickup<span>{job.pickup}</span></label>
          <label>Drop-off<span>{job.dropoff}</span></label>
          <label>Vehicle<span>{job.vehicle} · {job.rateClass}</span></label>
        </div>
        <label className="switch">
          <input type="checkbox" checked={afterHours} onChange={(event) => setAfterHours(event.target.checked)} />
          <span aria-hidden="true" />
          After-hours call
        </label>
        <QuotePanel job={job} options={{ afterHours }} />
      </div>
    </div>
  );
}

const outputs = ['Quote PDF', 'Customer email', 'Dispatch request', 'Client portal'] as const;
type Output = typeof outputs[number];

function OutputSheet({ output }: { output: Output }) {
  const job = JOBS[1];
  const result = quote(job);
  if (output === 'Customer email') {
    return (
      <article className="sheet sheet-email" data-ui>
        <header className="sheet-meta">
          <span><b>From</b> Pineywoods Heavy Recovery &lt;noreply@towcalc.com&gt;</span>
          <span><b>To</b> ops@pineywoodssiteworks.com</span>
          <span><b>Subject</b> Your transport quote - Q-2611-0427</span>
        </header>
        <div className="email-head">Pineywoods Heavy Recovery</div>
        <div className="email-body">
          <p className="email-tag">Quote ready</p>
          <h4>Your quote is ready</h4>
          <p>The complete transport quote is attached as a PDF for easy saving and sharing.</p>
          <div className="email-box">
            <span>Q-2611-0427</span>
            <strong>{money(result.total, true)}</strong>
            <p><b>Customer:</b> {job.customer}<br /><b>Equipment:</b> {job.vehicle}<br /><b>Route:</b> {job.pickup} to {job.dropoff}<br /><b>Permit flags:</b> Overweight, oversize width</p>
          </div>
          <p className="email-attach">Q-2611-0427.pdf · 84 KB</p>
        </div>
      </article>
    );
  }
  if (output === 'Dispatch request') {
    return (
      <article className="sheet sheet-email" data-ui>
        <header className="sheet-meta">
          <span><b>To</b> dispatch@pineywoodsrecovery.com</span>
          <span><b>Subject</b> Dispatch requested - Q-2611-0431</span>
        </header>
        <div className="email-head">Pineywoods Heavy Recovery × Pineywoods Site Works</div>
        <div className="email-body">
          <p className="email-tag is-action">Action requested</p>
          <h4>A client is ready to dispatch</h4>
          <p>Submitted by Marcus Bell. The estimate and BOL are attached.</p>
          <div className="email-box">
            <span>Q-2611-0431</span>
            <strong>{money(result.total, true)}</strong>
            <p><b>Equipment:</b> {job.vehicle}<br /><b>Route:</b> {job.pickup} to {job.dropoff}<br /><b>BOL:</b> bol-0431.pdf</p>
          </div>
          <p className="email-attach">Q-2611-0431.pdf · bol-0431.pdf</p>
        </div>
      </article>
    );
  }
  if (output === 'Client portal') {
    return (
      <article className="sheet sheet-portal" data-ui>
        <div className="portal-top"><span>Pineywoods Heavy Recovery</span><span>Client portal · Pineywoods Site Works</span></div>
        <h4>Request a quote</h4>
        <div className="portal-grid">
          <label>Pickup<span>{job.pickup}</span></label>
          <label>Drop-off<span>{job.dropoff}</span></label>
          <label>Equipment<span>CAT 320</span></label>
          <label>Operating weight<span className="num">50,100 lb</span></label>
          <label>Width<span className="num">112 in</span></label>
          <label>Height<span className="num">118 in</span></label>
        </div>
        <div className="portal-result">
          <div><span>Estimated total</span><strong className="num">{money(result.total, true)}</strong></div>
          <p>Permit required: oversize width. Your request goes to dispatch for approval.</p>
          <button type="button" tabIndex={-1}>Request dispatch</button>
        </div>
      </article>
    );
  }
  return (
    <article className="sheet sheet-pdf" data-ui>
      <header className="pdf-head">
        <div><strong>Pineywoods Heavy Recovery</strong><span>Henderson, TX · (903) 555-0142</span></div>
        <div className="pdf-ref"><span>Transport quote</span><strong>Q-2611-0427</strong><span>Oct 26, 2026</span></div>
      </header>
      <dl className="pdf-facts">
        <div><dt>Customer</dt><dd>{job.customer}</dd></div>
        <div><dt>Equipment</dt><dd>{job.vehicle}</dd></div>
        <div><dt>Pickup</dt><dd>{job.pickup}</dd></div>
        <div><dt>Drop-off</dt><dd>{job.dropoff}</dd></div>
      </dl>
      <table className="pdf-lines">
        <thead><tr><th>Item</th><th>Detail</th><th>Amount</th></tr></thead>
        <tbody>
          {result.lines.map((line) => <tr key={line.label}><td>{line.label}</td><td>{line.detail}</td><td className="num">{money(line.amount, true)}</td></tr>)}
        </tbody>
        <tfoot><tr><td colSpan={2}>Total, rounded to $25</td><td className="num">{money(result.total, true)}</td></tr></tfoot>
      </table>
      <p className="pdf-note">This non-binding estimate is based on the information submitted. Final pricing may change after verification of the route, equipment weight and dimensions, permits and site access.</p>
    </article>
  );
}

function Showcase() {
  const [output, setOutput] = useState<Output>('Quote PDF');
  return (
    <section className="showcase frame" id="product" aria-labelledby="showcase-title">
      <div className="showcase-index" data-reveal>
        <h2 id="showcase-title" className="lead-text">One quote, sent four ways</h2>
        <div className="output-list" role="tablist" aria-label="Quote outputs">
          {outputs.map((name) => (
            <button key={name} type="button" role="tab" aria-selected={name === output} onClick={() => setOutput(name)} onFocus={() => setOutput(name)}>
              {name}
            </button>
          ))}
        </div>
        <p>Every quote becomes a branded PDF, an email your customer can forward, a dispatch request with the bill of lading attached, or a price your client builds in their own portal.</p>
      </div>
      <div className="showcase-stage">
        <div key={output} className="sheet-swap"><OutputSheet output={output} /></div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const job = JOBS[0];
  return (
    <section className="how" id="how" aria-labelledby="how-title">
      <div className="how-column frame">
        <h2 id="how-title" className="head-text" data-reveal>From call to quote</h2>
        <div className="exchange" data-reveal>
          <p className="exchange-say">First, enter your rates once.</p>
          <div className="call" data-ui>
            <div className="rate-row"><span>Light duty</span><b className="num">$125 / h</b></div>
            <div className="rate-row"><span>Medium duty</span><b className="num">$165 / h</b></div>
            <div className="rate-row"><span>Heavy haul</span><b className="num">$200 / h</b></div>
            <div className="rate-row"><span>Drive-time buffer</span><b className="num">10%</b></div>
            <div className="rate-row"><span>Round quotes to</span><b className="num">$25</b></div>
          </div>
          <div className="response" data-ui><span className="ok-dot" aria-hidden="true" />Saved. Every dispatcher now quotes from these.</div>
        </div>
        <div className="exchange" data-reveal>
          <p className="exchange-say">Then take the call.</p>
          <div className="call" data-ui>
            <label className="typed">Pickup<span>{job.pickup}</span></label>
            <label className="typed">Drop-off<span>{job.dropoff}</span></label>
          </div>
          <div className="response" data-ui>
            <ol className="leg-list">
              {job.legs.map((leg) => <li key={leg.to}><span>{leg.from} → {leg.to}</span><span className="num">{leg.miles} mi · {duration(leg.minutes)}</span></li>)}
            </ol>
          </div>
        </div>
        <div className="exchange exchange-final" data-reveal>
          <p className="exchange-say">Last, send it before they hang up.</p>
          <div className="final" data-ui>
            <div className="final-head"><span>{job.vehicle}</span><span>{job.customer} · (903) 555-0118</span></div>
            <QuotePanel job={job} compact />
            <div className="final-actions"><button type="button" tabIndex={-1}>Email quote</button><button type="button" tabIndex={-1}>Download PDF</button><button type="button" tabIndex={-1}>Save to log</button></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Rules() {
  const job = JOBS[1];
  const [mode, setMode] = useState<'hourly' | 'mileage'>('hourly');
  const [zone, setZone] = useState(false);
  const [width, setWidth] = useState(job.widthIn);
  const [rounding, setRounding] = useState(25);
  const widthId = useId();
  const escort = escortsFor(width);
  return (
    <section className="rules" id="rules" aria-labelledby="rules-title">
      <div className="rules-field" aria-label="Quote that updates as you change the rules">
        <div className="rules-output" data-ui>
          <div className="ui-bar"><span>{job.vehicle}</span><span className="ui-muted">{job.customer}</span></div>
          <div className="ui-body">
            <QuotePanel job={job} options={{ mode, zoneSurcharge: zone, widthIn: width, rounding }} />
          </div>
        </div>
      </div>
      <h2 id="rules-title" className="head-text rules-title">Your rules, applied</h2>
      <div className="rules-copy">
        <div className="rule-block">
          <h3 className="lead-text">Charge by the hour or by the mile.</h3>
          <p>Hourly quotes use drive time plus your buffer and load time. Mileage quotes use the full loop from your yard and back.</p>
          <div className="seg seg-light" role="radiogroup" aria-label="Pricing mode">
            <button type="button" role="radio" aria-checked={mode === 'hourly'} onClick={() => setMode('hourly')}>Hourly</button>
            <button type="button" role="radio" aria-checked={mode === 'mileage'} onClick={() => setMode('mileage')}>Per mile</button>
          </div>
        </div>
        <div className="rule-block">
          <h3 className="lead-text">Zones charge for themselves.</h3>
          <p>Draw a service area on the map and give it a surcharge, a flat rate or a ceiling. Routes that pass through it pick it up automatically.</p>
          <label className="switch switch-light">
            <input type="checkbox" checked={zone} onChange={(event) => setZone(event.target.checked)} />
            <span aria-hidden="true" />
            Route passes through the Dallas core zone
          </label>
          <figure className="rule-photo">
            <img src="/assets/bush-turnpike-at-us75-february-2020.jpg" width={1920} height={1265} alt="The Bush Turnpike interchange with US 75 in north Dallas" loading="lazy" decoding="async" />
          </figure>
        </div>
        <div className="rule-block">
          <h3 className="lead-text">Oversize loads flag their permits.</h3>
          <p>Weight and dimensions are checked against the states on the route. Permits and escorts are added at your cost before anyone loads.</p>
          <label htmlFor={widthId} className="range-label">Load width <b className="num">{width} in</b> {escort.vehicles ? `· ${escort.vehicles} escort${escort.vehicles > 1 ? 's' : ''}` : width > 102 ? '· permit' : '· legal'}</label>
          <input id={widthId} className="range" type="range" min={84} max={180} step={2} value={width} onChange={(event) => setWidth(Number(event.target.value))} />
          <figure className="rule-photo">
            <img src="/assets/globe-trailers-detachable-gooseneck-trailer.jpg" width={1000} height={461} alt="A Komatsu PC400 excavator loaded on a detachable gooseneck trailer" loading="lazy" decoding="async" />
          </figure>
        </div>
        <div className="rule-block">
          <h3 className="lead-text">Round the way you round.</h3>
          <p>Every total lands on your increment, so two dispatchers never quote the same job $12 apart.</p>
          <div className="seg seg-light" role="radiogroup" aria-label="Round to">
            {[5, 25, 50].map((value) => (
              <button key={value} type="button" role="radio" aria-checked={rounding === value} onClick={() => setRounding(value)}>${value}</button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [selected, setSelected] = useState(1);
  const plan = plans[selected];
  return (
    <section className="pricing frame" id="pricing" aria-labelledby="pricing-title">
      <h2 id="pricing-title" className="sr-heading">Plans</h2>
      <div className="plan-names" role="tablist" aria-label="Plans">
        {plans.map((item, index) => (
          <div key={item.name} className="plan-item">
            <button type="button" role="tab" aria-selected={index === selected} onClick={() => setSelected(index)} onFocus={() => setSelected(index)}>
              {item.name}
            </button>
            {index === selected && <PlanStage plan={item} className="plan-stage-inline" />}
          </div>
        ))}
      </div>
      <PlanStage key={plan.name} plan={plan} className="plan-stage" />
    </section>
  );
}

function PlanStage({ plan, className }: { plan: typeof plans[number]; className: string }) {
  return (
    <div className={className}>
      <p className="plan-price"><span className="display-text num">{plan.price}</span>{plan.period && <span className="plan-period">{plan.period}</span>}</p>
      <p className="plan-annual">{plan.annual}</p>
      <p className="plan-body">{plan.description}</p>
      <a className="button" href={REQUEST_URL}>{plan.cta}</a>
    </div>
  );
}

function Questions() {
  const [selected, setSelected] = useState(0);
  return (
    <section className="faq frame" id="questions" aria-labelledby="faq-title">
      <div className="faq-list">
        <h2 id="faq-title" className="faq-heading">Common questions</h2>
        {faqs.map((item, index) => (
          <div key={item.q} className="faq-item">
            <button type="button" aria-expanded={index === selected} onClick={() => setSelected(index)} onFocus={() => setSelected(index)} onMouseEnter={() => setSelected(index)}>
              <span className="dot" aria-hidden="true" />{item.q}
            </button>
            {index === selected && <p className="faq-inline">{item.a}</p>}
          </div>
        ))}
      </div>
      <div className="faq-pane" aria-live="polite">
        <p key={selected} className="faq-answer">{faqs[selected].a}</p>
      </div>
    </section>
  );
}

export default function Home() {
  useReveal();
  return (
    <>
      <header className="nav frame">
        <a href="#top" className="wordmark" aria-label="TowCalc home">
          <img src="/towcalc_fulllogo_dark.svg" width={150} height={46} alt="TowCalc Pro" />
        </a>
        <nav aria-label="Main">
          <a href="#product">Product</a>
          <a href="#rules">Rules</a>
          <a href="#pricing">Pricing</a>
          <a href="#questions">Questions</a>
          <a href={APP_URL}>Log in</a>
        </nav>
        <a className="button button-small" href={REQUEST_URL}>Request access</a>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy frame">
            <h1 id="hero-title" className="display-text">Price the tow<br /> while they wait.</h1>
            <p className="lead-text">TowCalc applies your rates, zones and permit rules to every call, so each dispatcher quotes the same job the same way.</p>
            <a className="button" href={REQUEST_URL}>Request access</a>
          </div>
          <div className="hero-stage">
            <HeroFragment />
          </div>
        </section>

        <Showcase />
        <HowItWorks />

        <figure className="band shutter">
          <img src="/assets/hth-winter-recovery.jpg" width={1800} height={1200} alt="A heavy rotator wrecker working a roadside recovery at night in a snowstorm" loading="eager" decoding="async" />
          <figcaption className="frame">A 50-ton rotator on a winter recovery. The quote was the easy part.</figcaption>
        </figure>

        <Rules />
        <Pricing />
        <Questions />

        <section className="cta" id="access" aria-labelledby="cta-title">
          <div className="frame cta-inner">
            <h2 id="cta-title" className="display-text">Bring your rates.<br /> We do the math.</h2>
            <div className="cta-side">
              <p>Tell us about your company and we&rsquo;ll set up your workspace with your rates, yards and service areas.</p>
              <a className="button button-ink" href={REQUEST_URL}>Request access</a>
            </div>
          </div>
          <figure className="cta-photo">
            <img src="/assets/kenworth-t650-tow-truck.jpg" width={1920} height={1280} alt="A white and blue Kenworth T650 heavy recovery truck parked on grass" loading="eager" decoding="async" />
          </figure>
        </section>
      </main>

      <footer className="footer frame">
        <p className="credits">Photographs: &ldquo;HTH Winter Recovery&rdquo; by Great Pacific TV (CC BY 4.0); &ldquo;Kenworth T650 tow truck&rdquo; by Bidgee (CC BY-SA 3.0 AU); &ldquo;Globe Trailers detachable gooseneck trailer&rdquo; by Leighketchum (CC BY-SA 3.0); &ldquo;Bush Turnpike at US75&rdquo; by Danazar (CC BY-SA 4.0); all via Wikimedia Commons. Sample companies and prices are illustrative.</p>
        <div className="footer-line">
          <span>Quoting software for towing</span>
          <nav aria-label="Footer">
            <a href={APP_URL}>Log in</a>
            <a href="mailto:office@towcalc.com">office@towcalc.com</a>
          </nav>
          <span>© 2026 toolBox Digital Solutions · <a href={`${APP_URL}/privacy`}>Privacy</a> · <a href={`${APP_URL}/terms`}>Terms</a></span>
        </div>
      </footer>
    </>
  );
}
