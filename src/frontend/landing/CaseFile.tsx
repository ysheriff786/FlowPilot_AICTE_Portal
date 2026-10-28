import React, { useRef } from 'react';
import { CASE_META, STAGES, type Stage, type StageKey } from './landingData';

const STATE_CLASS: Record<string, string> = {
  Uploaded: 'fp-ui-chip--quiet',
  Approved: 'fp-ui-chip--good',
  'Correction requested': 'fp-ui-chip--warn',
  Pending: 'fp-ui-chip--quiet',
};

const DocumentTray: React.FC<{ stage: Stage }> = ({ stage }) => {
  const approved = stage.documents.filter((document) => document.state === 'Approved').length;

  return (
    <div className="fp-case__documents">
      <div className="fp-case__documents-head">
        <span>Required documents</span>
        <span>
          {approved} of {stage.documents.length} approved
        </span>
      </div>
      <ul>
        {stage.documents.map((document) => (
          <li key={document.name}>
            <span className="fp-case__doc-name">{document.name}</span>
            <span className="fp-case__doc-detail">{document.detail}</span>
            <span className={`fp-ui-chip ${STATE_CLASS[document.state]}`}>{document.state}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

interface CaseFileProps {
  active: StageKey;
  onChange: (stage: StageKey) => void;
}

export const CaseFile: React.FC<CaseFileProps> = ({ active, onChange }) => {
  const stage = STAGES.find((item) => item.key === active) ?? STAGES[0];
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (index: number, delta: number) => {
    const next = (index + delta + STAGES.length) % STAGES.length;
    onChange(STAGES[next].key);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="fp-case">
      <div className="fp-case__tabs" role="tablist" aria-label="Approval stages">
        {STAGES.map((item, index) => {
          const selected = active === item.key;
          return (
            <button
              key={item.key}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`case-tab-${item.key}`}
              type="button"
              role="tab"
              className={`fp-case__tab${selected ? ' is-active' : ''}`}
              aria-selected={selected}
              aria-controls="case-file-panel"
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(item.key)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  move(index, 1);
                }
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  move(index, -1);
                }
                if (event.key === 'Home') {
                  event.preventDefault();
                  onChange(STAGES[0].key);
                  tabRefs.current[0]?.focus();
                }
                if (event.key === 'End') {
                  event.preventDefault();
                  onChange(STAGES[STAGES.length - 1].key);
                  tabRefs.current[STAGES.length - 1]?.focus();
                }
              }}
            >
              <span className="fp-case__tab-label">{item.label}</span>
              <span className="fp-case__tab-date">{item.date.split(' · ')[0]}</span>
            </button>
          );
        })}
      </div>

      <div
        className={`fp-case__panel${stage.key === 'APPROVED' ? ' fp-case__panel--approved' : ''}`}
        id="case-file-panel"
        role="tabpanel"
        aria-labelledby={`case-tab-${stage.key}`}
        tabIndex={0}
        data-ui
      >
        <div className="fp-case__panel-top">
          <div>
            <p className="fp-case__kicker">Application file</p>
            <p className="fp-case__ref">{CASE_META.ref}</p>
          </div>
          <span className="fp-case__sample">Sample file · illustrative</span>
        </div>

        <div className="fp-case__meta">
          <div>
            <span>Institution</span>
            <strong>{CASE_META.institution}</strong>
          </div>
          <div>
            <span>Category</span>
            <strong>{CASE_META.category}</strong>
          </div>
          <div>
            <span>Academic year</span>
            <strong>{CASE_META.year}</strong>
          </div>
          <div>
            <span>Region</span>
            <strong>
              {CASE_META.state} · {CASE_META.region}
            </strong>
          </div>
        </div>

        <div className="fp-case__progress" aria-hidden="true">
          {STAGES.map((item, index) => {
            const current = STAGES.findIndex((entry) => entry.key === stage.key);
            return (
              <span
                key={item.key}
                className={
                  index < current
                    ? 'is-done'
                    : index === current
                      ? item.key === 'CORRECTION_REQUIRED'
                        ? 'is-current is-warn'
                        : 'is-current'
                      : ''
                }
              />
            );
          })}
        </div>

        <div className="fp-case__stage-line">
          <span>{stage.label}</span>
          <span>{stage.date}</span>
        </div>

        <div className="fp-case__body" key={stage.key}>
          <div className="fp-case__body-head">
            <p className="fp-case__action">{stage.action}</p>
            <span className="fp-ui-chip fp-ui-chip--actor">{stage.actor}</span>
          </div>
          {stage.key === 'CORRECTION_REQUIRED' ? (
            <div className="fp-case__comment">
              <span>Officer comment</span>
              <p>{stage.note}</p>
            </div>
          ) : (
            <p className="fp-case__note">{stage.note}</p>
          )}
        </div>

        <DocumentTray stage={stage} />

        <div className="fp-case__gate">
          <span>Gate</span>
          <p>{stage.gate}</p>
        </div>

        <div className="fp-case__next">
          <div>
            <span>Next</span>
            <p>{stage.next}</p>
          </div>
          <span className="fp-case__audit">{stage.audit}</span>
        </div>

        {stage.key === 'APPROVED' && (
          <div className="fp-case__stamp" aria-hidden="true">
            Approved
          </div>
        )}

        <p className="fp-sr-only" aria-live="polite" aria-atomic="true">
          {stage.summary}
        </p>
      </div>
    </div>
  );
};
