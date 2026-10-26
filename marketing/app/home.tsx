'use client';

import { useEffect, useState } from 'react';
import { JOBS, YARDS, bestYard, duration, money, quote, type YardId } from './quote-model';
import { copy, faqs, plans } from './site-content';

const APP_URL = 'https://app.towcalc.com';
const REQUEST_URL = `${APP_URL}/?request`;

function useReveal() {
  useEffect(() => {
    document.documentElement.classList.add('js');
    const targets = document.querySelectorAll('[data-reveal]');
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

function LiveQuote() {
  const [jobId, setJobId] = useState('sedan');
  const [yard, setYard] = useState<YardId>('henderson');
  const [afterHours, setAfterHours] = useState(false);
  const job = JOBS.find((item) => item.id === jobId) ?? JOBS[0];
  const result = quote(job, yard, afterHours);
  const better = bestYard(job, yard, afterHours);

  return (
    <div className="demo" data-ui>
      <div className="demo-bar">
        <span>{copy.demo.label}</span>
        <div className="seg" role="radiogroup" aria-label="Sample job">
          {JOBS.map((item) => (
            <button key={item.id} type="button" role="radio" aria-checked={item.id === jobId} onClick={() => setJobId(item.id)}>{item.label}</button>
          ))}
        </div>
      </div>

      <div className="demo-body">
        <div className="demo-total">
          <div>
            <span className="demo-vehicle">{job.vehicle}</span>
            <strong className="num" aria-live="polite">{money(result.total)}</strong>
            <span className="demo-meta num">{result.hours.toFixed(2)} h · {result.miles} mi · {job.rateClass} ${job.hourlyRate}/h</span>
          </div>
        </div>

        <div className="demo-row">
          <span className="demo-label">{copy.demo.yardLabel}</span>
          <div className="seg seg-yards" role="radiogroup" aria-label={copy.demo.yardLabel}>
            {YARDS.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={item.id === yard} onClick={() => setYard(item.id)}>{item.name.replace(' yard', '')}</button>
            ))}
          </div>
        </div>

        {better && (
          <div className="demo-suggest" role="status">
            <p><b>{better.name}</b> {copy.demo.wouldQuote} <em>{money(better.savings)} {copy.demo.less}</em>{better.minutesSaved > 0 ? ` · ${better.minutesSaved} min less driving` : ''}.</p>
            <button type="button" onClick={() => setYard(better.id)}>{copy.demo.switchYard} {better.name}</button>
          </div>
        )}

        <label className="switch">
          <input type="checkbox" checked={afterHours} onChange={(event) => setAfterHours(event.target.checked)} />
          <span aria-hidden="true" />
          {copy.demo.afterHours}
        </label>

        <ol className="demo-route" aria-label="Route">
          {result.legs.map((item) => (
            <li key={`${item.from}-${item.to}`} className={item.deadhead ? 'is-deadhead' : ''}>
              <span>{item.from} → {item.to}</span>
              <span className="num">{item.miles} mi · {duration(item.minutes)}</span>
            </li>
          ))}
        </ol>

        <dl className="demo-lines">
          {result.lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label} <small>{line.detail}</small></dt>
              <dd className="num">{money(line.amount, true)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function YardFragment() {
  return (
    <div className="frag frag-yard" data-ui aria-hidden="true">
      <p><b>Tyler yard</b> would quote <em>$75 less</em> · 34 min less driving.</p>
      <span className="frag-button">Quote from Tyler yard</span>
    </div>
  );
}

function ChargesFragment() {
  return (
    <div className="frag" data-ui aria-hidden="true">
      <div className="frag-chips">
        <span className="chip is-on">Dallas core zone +15%</span>
        <span className="chip is-on">After hours +25%</span>
        <span className="chip">Winch out +$75</span>
      </div>
      <div className="frag-permit"><span>Permit flag</span><b>Oversize width · TX, LA</b></div>
    </div>
  );
}

function SendFragment() {
  return (
    <div className="frag frag-send" data-ui aria-hidden="true">
      <span className="frag-title">Send quote Q-2611-0427</span>
      <span className="frag-option is-on">Branded PDF</span>
      <span className="frag-option">Email to customer</span>
      <span className="frag-option">Dispatch request + BOL</span>
      <span className="frag-option">Client portal</span>
    </div>
  );
}

const FRAGMENTS = [YardFragment, ChargesFragment, SendFragment];

function Pricing() {
  const [selected, setSelected] = useState(1);
  const plan = plans[selected];
  return (
    <section className="pricing frame" id="pricing" aria-labelledby="pricing-title">
      <div className="pricing-names">
        <h2 id="pricing-title" className="section-label">{copy.pricing.heading}</h2>
        <div role="tablist" aria-label="Plans">
          {plans.map((item, index) => (
            <button key={item.name} type="button" role="tab" aria-selected={index === selected} onClick={() => setSelected(index)} onFocus={() => setSelected(index)}>
              {item.name}
            </button>
          ))}
        </div>
        <p className="pricing-note">{copy.pricing.note}</p>
      </div>
      <div key={plan.name} className="pricing-stage">
        <p className="pricing-figure"><span className="num">{plan.price}</span>{plan.period && <small>{plan.period}</small>}</p>
        <p className="pricing-annual">{plan.annual}</p>
        <p className="pricing-body">{plan.description}</p>
        <a className="button" href={REQUEST_URL}>{plan.cta}</a>
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
          <img src="/towcalc_fulllogo_light.svg" width={150} height={46} alt="TowCalc Pro" />
        </a>
        <nav aria-label="Main">
          <a href="#features">{copy.nav.features}</a>
          <a href="#trust">{copy.nav.trust}</a>
          <a href="#pricing">{copy.nav.pricing}</a>
          <a href="#questions">{copy.nav.questions}</a>
          <a href={APP_URL}>{copy.nav.logIn}</a>
        </nav>
        <a className="button button-small" href={REQUEST_URL}>{copy.nav.requestAccess}</a>
      </header>

      <main id="top">
        <section className="hero frame" aria-labelledby="hero-title">
          <div className="hero-copy">
            <h1 id="hero-title">{copy.hero.headlineLine1}<br />{copy.hero.headlineLine2}</h1>
            <p>{copy.hero.text}</p>
            <div className="hero-actions">
              <a className="button" href={REQUEST_URL}>{copy.hero.button}</a>
              <a className="text-link" href="#demo">{copy.hero.secondary}</a>
            </div>
          </div>
          <div className="hero-stage" id="demo">
            <LiveQuote />
            <p className="demo-footnote">{copy.demo.footnote}</p>
          </div>
        </section>

        <section className="features frame" id="features" aria-labelledby="features-title">
          <h2 id="features-title" className="section-heading" data-reveal><span>{copy.features.heading}</span></h2>
          <div className="feature-list">
            {copy.features.items.map((item, index) => {
              const Fragment = FRAGMENTS[index];
              return (
                <article key={item.title} className="feature" data-reveal>
                  <div className="feature-copy">
                    <h3>{item.title}</h3>
                    <p>{item.text}</p>
                  </div>
                  <Fragment />
                </article>
              );
            })}
          </div>
        </section>

        <section className="trust" id="trust" aria-labelledby="trust-title">
          <div className="frame trust-inner" data-reveal>
            <div>
              <h2 id="trust-title">{copy.trust.heading}</h2>
              <p>{copy.trust.text}</p>
            </div>
            <ul>
              {copy.trust.points.map((point) => <li key={point}>{point}</li>)}
            </ul>
          </div>
        </section>

        <Pricing />

        <section className="faq frame" id="questions" aria-labelledby="faq-title">
          <h2 id="faq-title" className="section-label">{copy.questions.heading}</h2>
          <div className="faq-list">
            {faqs.map((item, index) => (
              <details key={item.q} open={index === 0}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="closing frame" aria-labelledby="closing-title">
          <h2 id="closing-title">{copy.closing.headlineLine1}<br />{copy.closing.headlineLine2}</h2>
          <div className="closing-side">
            <p>{copy.closing.text}</p>
            <a className="button" href={REQUEST_URL}>{copy.closing.button}</a>
          </div>
        </section>
      </main>

      <footer className="footer frame">
        <span>{copy.footer.tagline}</span>
        <nav aria-label="Footer">
          <a href={APP_URL}>{copy.nav.logIn}</a>
          <a href={`mailto:${copy.footer.email}`}>{copy.footer.email}</a>
        </nav>
        <span>{copy.footer.copyright} · <a href={`${APP_URL}/privacy`}>Privacy</a> · <a href={`${APP_URL}/terms`}>Terms</a></span>
      </footer>
    </>
  );
}
