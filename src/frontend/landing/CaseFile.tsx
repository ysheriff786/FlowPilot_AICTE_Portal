import React from 'react';
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

  return (
    <div className="fp-case">
      <div className="fp-case__ledger" role="group" aria-label="Approval stages">
        {STAGES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`fp-case__stage${active === item.key ? ' is-active' : ''}`}
            aria-pressed={active === item.key}
            aria-controls="case-file-panel"
            onClick={() => onChange(item.key)}
          >
            <span className="fp-case__stage-dot" aria-hidden="true" />
            <span className="fp-case__stage-copy">
              <span className="fp-case__stage-label">{item.label}</span>
              <span className="fp-case__stage-date">{item.date}</span>
            </span>
          </button>
        ))}
        <p className="fp-case__hint">Choose a stage to see the gate.</p>
      </div>

      <div
        className={`fp-case__panel${stage.key === 'APPROVED' ? ' fp-case__panel--approved' : ''}`}
        id="case-file-panel"
        data-ui
      >
        <div className="fp-case__panel-top">
          <div>
            <p className="fp-case__kicker">Application</p>
            <p className="fp-case__ref">{CASE_META.ref}</p>
          </div>
          <span className="fp-case__sample">Sample file</span>
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
