import React from 'react';
import {
  FAQS,
  STAGES,
  type StageKey,
} from './landingData';
import {
  AuditTable,
  Inspection,
  ScopeTable,
  Undertaking,
  Watchlist,
} from './Fragments';

const revealStyle = (delay: number) =>
  ({ '--reveal-delay': `${delay}ms` }) as React.CSSProperties;

export const Hero: React.FC = () => (
  <section className="fp-hero" data-chapter="blue" aria-labelledby="hero-title">
    <div className="fp-shell fp-hero__shell">
      <div className="fp-hero__copy">
        <h1 className="fp-hero__title" id="hero-title">
          <span className="fp-hero__line fp-hero__line--pale">
            <span className="fp-hero__line-inner">AICTE approvals,</span>
          </span>
          <span className="fp-hero__line fp-hero__line--dark">
            <span className="fp-hero__line-inner">one clear file.</span>
          </span>
        </h1>

        <div className="fp-hero__foot">
          <p className="fp-hero__support">
            Every document, correction, inspection and signature on one record, from
            submission to sanction.
          </p>
          <a className="fp-button fp-hero__action" href="#the-file">
            Walk the file
          </a>
        </div>

        <div className="fp-hero__base">
          <span>Sample file · AICTE/2026/0412</span>
          <span>Six gates · 12 Aug – 27 Sep 2026</span>
        </div>
      </div>
    </div>
  </section>
);

export const Showcase: React.FC = () => (
  <section className="fp-showcase" data-chapter="paper" aria-labelledby="showcase-title">
    <div className="fp-shell">
      <div className="fp-showcase__head" data-reveal>
        <h2 id="showcase-title">Filed, then stamped.</h2>
        <p>
          The same application is submitted, corrected, inspected and sanctioned without
          leaving the record. No parallel spreadsheet, no forwarded email, no second version
          to reconcile.
        </p>
      </div>
    </div>

    <div className="fp-showcase__specimens" aria-hidden="true">
      <div className="fp-specimen" data-reveal style={revealStyle(80)}>
        <span className="fp-specimen__word">filed</span>
      </div>
      <div
        className="fp-specimen fp-specimen--second"
        data-reveal
        style={revealStyle(160)}
      >
        <span className="fp-specimen__word">stamped</span>
      </div>
    </div>

    <div className="fp-shell">
      <p className="fp-showcase__note" data-reveal>
        Filed 12 August. Stamped 27 September. The same application, 46 days later.
      </p>
    </div>
  </section>
);

interface GatesProps {
  active: StageKey;
  onSelect: (stage: StageKey) => void;
}

export const Gates: React.FC<GatesProps> = ({ active, onSelect }) => (
  <section className="fp-gates" id="gates" data-chapter="pale" aria-labelledby="gates-title">
    <div className="fp-shell">
      <div className="fp-gates__head" data-reveal>
        <h2 id="gates-title">What opens each gate.</h2>
        <p>
          Each stage opens only when its gate is satisfied. Choose a gate to see the
          sample file at that point.
        </p>
      </div>

      <ol className="fp-gates__list">
        {STAGES.map((stage, index) => (
          <li key={stage.key} data-reveal style={revealStyle(index * 55)}>
            <button
              type="button"
              className={`fp-gate${active === stage.key ? ' is-active' : ''}`}
              aria-pressed={active === stage.key}
              onClick={() => onSelect(stage.key)}
            >
              <span className="fp-gate__word">{stage.short}</span>
              <span className="fp-gate__detail">
                <span>{stage.date}</span>
                <span>{stage.gate}</span>
              </span>
              <span className="fp-gate__arrow" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export const PhotoBand: React.FC = () => (
  <section className="fp-photos" data-chapter="paper" aria-labelledby="photos-title">
    <div className="fp-shell">
      <div className="fp-photos__head" data-reveal>
        <h2 id="photos-title">
          Campus
          <span>to council.</span>
        </h2>
        <p>
          An application begins on a campus and ends at a desk. The same record carries the
          evidence across both.
        </p>
      </div>
    </div>

    <figure className="fp-photo fp-photo--wide" data-reveal>
      <div className="fp-photo__frame">
        <img
          src="/landing/aicte-head-office.jpg"
          width={1920}
          height={858}
          alt="The AICTE head office building in New Delhi."
          loading="lazy"
          decoding="async"
        />
      </div>
      <figcaption className="fp-shell fp-photo__caption">
        <span>AICTE Head Office</span>
        <span>New Delhi, India</span>
        <span>Photograph by Timothy A. Gonsalves · CC BY-SA 4.0</span>
      </figcaption>
    </figure>

    <div className="fp-shell fp-photos__chapter">
      <figure className="fp-photo fp-photo--archive" data-reveal>
        <div className="fp-photo__frame">
          <img
            src="/landing/mechanical-laboratory-at-the-college-of-engineering.jpg"
            width={1639}
            height={1053}
            alt="An archival postcard of the mechanical laboratory at the College of Engineering, Poona."
            loading="lazy"
            decoding="async"
          />
        </div>
        <figcaption>
          Mechanical Laboratory, College of Engineering, Poona. Postcard by Raphael Tuck &amp;
          Sons, CC BY 4.0.
        </figcaption>
      </figure>

      <div className="fp-photos__copy" data-reveal style={revealStyle(100)}>
        <p className="fp-photos__statement">
          Every approval rests on a building, a faculty list and a laboratory someone can
          visit.
        </p>
        <p>
          The record does not replace that evidence. It keeps the evidence attached to the
          decision that used it.
        </p>
        <p className="fp-photos__micro">Archival postcard · Poona, undated</p>
      </div>
    </div>

    <div className="fp-shell fp-photos__pair">
      <figure className="fp-photo fp-photo--portrait" data-reveal>
        <div className="fp-photo__frame">
          <img
            src="/landing/college-of-engineering-gunndy.jpg"
            width={1600}
            height={1200}
            alt="The red brick main building of the College of Engineering, Guindy campus in Chennai."
            loading="lazy"
            decoding="async"
          />
        </div>
        <figcaption>
          College of Engineering, Guindy, Chennai. Photograph by N. Vivekananthamoorthy,
          CC BY 4.0.
        </figcaption>
      </figure>

      <figure className="fp-photo fp-photo--lab" data-reveal style={revealStyle(90)}>
        <div className="fp-photo__frame">
          <img
            src="/landing/sir-j-c-bose-laboratory-complex-indian.jpg"
            width={1920}
            height={1277}
            alt="The Sir J. C. Bose laboratory complex on the IIT Kharagpur campus."
            loading="lazy"
            decoding="async"
          />
        </div>
        <figcaption>
          Sir J. C. Bose Laboratory Complex, IIT Kharagpur. Photograph by Biswarup Ganguly,
          CC BY 3.0.
        </figcaption>
      </figure>
    </div>
  </section>
);

export const AfterStamp: React.FC = () => (
  <section className="fp-after" data-chapter="paper" aria-labelledby="after-title">
    <div className="fp-shell">
      <div className="fp-after__head" data-reveal>
        <h2 id="after-title">After the stamp.</h2>
        <p>
          Approval is a stage, not the end. The same record carries expiries, undertakings
          and inspections, and the scheduler sends each reminder once.
        </p>
      </div>

      <div className="fp-after__list">
        <article className="fp-exchange" data-reveal>
          <div className="fp-exchange__copy">
            <h3>First, a certificate nears expiry.</h3>
            <div className="fp-call">
              <span className="fp-call__title">Fire safety certificate</span>
              <span className="fp-call__meta">Expires 06 Nov 2026 · 10 days</span>
            </div>
          </div>
          <div className="fp-response">
            <Watchlist />
          </div>
        </article>

        <article className="fp-exchange" data-reveal>
          <div className="fp-exchange__copy">
            <h3>Then an undertaking comes due.</h3>
            <div className="fp-call">
              <span className="fp-call__title">Library upgrade</span>
              <span className="fp-call__meta">Due 31 Dec 2026 · Evidence uploaded</span>
            </div>
          </div>
          <div className="fp-response">
            <Undertaking />
          </div>
        </article>

        <article className="fp-exchange fp-exchange--last" data-reveal>
          <div className="fp-exchange__copy">
            <h3>Finally, the first compliance visit is scheduled.</h3>
            <div className="fp-call">
              <span className="fp-call__title">14 Nov 2026 · 10:30</span>
              <span className="fp-call__meta">Three-member committee · Post-approval</span>
            </div>
          </div>
          <div className="fp-response">
            <Inspection />
          </div>
        </article>
      </div>
    </div>
  </section>
);

export const ScopeSection: React.FC = () => (
  <section className="fp-scope" data-chapter="pale" aria-labelledby="scopes-title">
    <div className="fp-shell">
      <div className="fp-scope__head" data-reveal>
        <h2 id="scopes-title">
          Who sees
          <span>what.</span>
        </h2>
        <p>
          A college sees its own institution. An officer sees the files routed to them.
          An administrator sees every file and every rule, but no one skips a gate.
        </p>
      </div>

      <div data-reveal style={revealStyle(100)}>
        <ScopeTable />
      </div>
    </div>
  </section>
);

export const RecordSection: React.FC = () => (
  <section className="fp-record" id="record" data-chapter="dark" aria-labelledby="record-title">
    <div className="fp-shell">
      <div className="fp-record__head" data-reveal>
        <h2 id="record-title">
          Every move,
          <span>written down.</span>
        </h2>
        <p>
          Every write records the actor, the action and the status before and after.
          Administrators and officers can export the consolidated record as CSV.
        </p>
      </div>

      <div data-reveal style={revealStyle(100)}>
        <AuditTable />
      </div>
    </div>
  </section>
);

export const Questions: React.FC = () => (
  <section className="fp-faq" id="questions" data-chapter="paper" aria-labelledby="questions-title">
    <div className="fp-shell">
      <h2 className="fp-faq__title" id="questions-title" data-reveal>
        Questions,
        <span>answered.</span>
      </h2>

      <div className="fp-faq__list">
        {FAQS.map((faq, index) => (
          <details
            className="fp-faq__item"
            key={faq.question}
            data-reveal
            style={revealStyle(index * 45)}
          >
            <summary>
              <span>{faq.question}</span>
              <span className="fp-faq__chevron" aria-hidden="true" />
            </summary>
            <p>{faq.answer}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

export const ClosingCta: React.FC = () => (
  <section className="fp-cta" data-chapter="blue" aria-labelledby="cta-title">
    <div className="fp-shell">
      <h2 className="fp-cta__sentence" id="cta-title" data-reveal>
        Walk{' '}
        <a className="fp-cta__fill" href="#the-file" aria-label="Walk the file from start to stamp">
          the file
        </a>
        <br />
        from start to stamp.
      </h2>

      <div className="fp-cta__foot">
        <p className="fp-cta__note" data-reveal style={revealStyle(120)}>
          Sample file AICTE/2026/0412 · Aruna College of Engineering · 12 Aug – 27 Sep 2026.
          Illustrative records, not AICTE data.
        </p>
        <dl className="fp-cta__facts" data-reveal style={revealStyle(180)}>
          <div>
            <dt>Sample file</dt>
            <dd>AICTE/2026/0412</dd>
          </div>
          <div>
            <dt>Institution</dt>
            <dd>Aruna College of Engineering</dd>
          </div>
          <div>
            <dt>Duration</dt>
            <dd>46 days · six gates</dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
);
