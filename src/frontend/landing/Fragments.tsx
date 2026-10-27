import React from 'react';
import {
  AUDIT_ROWS,
  INSPECTION,
  SCOPES,
  UNDERTAKING,
  WATCHLIST,
} from './landingData';

export const ScopeTable: React.FC = () => (
  <div className="fp-scopes" role="list" aria-labelledby="scopes-title">
    {SCOPES.map((scope) => (
      <article className="fp-scope-row" role="listitem" key={scope.role}>
        <h3>{scope.role}</h3>
        <dl>
          <div>
            <dt>Sees</dt>
            <dd>{scope.sees}</dd>
          </div>
          <div>
            <dt>Can act on</dt>
            <dd>{scope.acts}</dd>
          </div>
          <div>
            <dt>Cannot</dt>
            <dd>{scope.cannot}</dd>
          </div>
        </dl>
      </article>
    ))}
  </div>
);

export const AuditTable: React.FC = () => (
  <div className="fp-audit" data-ui>
    <div className="fp-audit__head">
      <div>
        <p className="fp-ui-label">Audit trail</p>
        <p className="fp-audit__title">Append-only record</p>
      </div>
      <span className="fp-ui-chip fp-ui-chip--quiet">Consolidated CSV</span>
    </div>
    <table>
      <caption className="fp-sr-only">Sample audit trail for application AICTE/2026/0412</caption>
      <thead>
        <tr>
          <th scope="col">Time</th>
          <th scope="col">Actor</th>
          <th scope="col">Action</th>
          <th scope="col">From</th>
          <th scope="col">To</th>
        </tr>
      </thead>
      <tbody>
        {AUDIT_ROWS.map((row) => (
          <tr key={`${row.time}-${row.action}`}>
            <td data-label="Time">{row.time}</td>
            <td data-label="Actor">{row.actor}</td>
            <td data-label="Action">{row.action}</td>
            <td data-label="From">{row.from}</td>
            <td data-label="To">{row.to}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="fp-audit__note">Every write records the actor, the action and the status before and after.</p>
  </div>
);

export const Watchlist: React.FC = () => (
  <div className="fp-watch" data-ui>
    <div className="fp-watch__head">
      <div>
        <p className="fp-ui-label">Expiring documents</p>
        <p className="fp-watch__title">Next 30 days</p>
      </div>
      <span className="fp-ui-chip fp-ui-chip--warn">3 open</span>
    </div>
    <ul>
      {WATCHLIST.map((item) => (
        <li key={item.name}>
          <div>
            <span className="fp-watch__name">{item.name}</span>
            <span className="fp-watch__meta">{item.meta}</span>
          </div>
          <span className={`fp-watch__value fp-watch__value--${item.tone}`}>{item.value}</span>
        </li>
      ))}
    </ul>
    <p className="fp-watch__note">The scheduler sends each reminder once; a second run creates no duplicate.</p>
  </div>
);

export const Undertaking: React.FC = () => (
  <div className="fp-slip" data-ui>
    <div className="fp-slip__top">
      <p className="fp-ui-label">Undertaking</p>
      <span className="fp-ui-chip fp-ui-chip--good">{UNDERTAKING.state}</span>
    </div>
    <p className="fp-slip__title">{UNDERTAKING.title}</p>
    <p className="fp-slip__meta">{UNDERTAKING.due}</p>
    <div className="fp-slip__foot">
      <span>Verification</span>
      <strong>{UNDERTAKING.detail}</strong>
    </div>
  </div>
);

export const Inspection: React.FC = () => (
  <div className="fp-slip" data-ui>
    <div className="fp-slip__top">
      <p className="fp-ui-label">Expert committee</p>
      <span className="fp-ui-chip fp-ui-chip--quiet">{INSPECTION.state}</span>
    </div>
    <p className="fp-slip__title">{INSPECTION.date}</p>
    <p className="fp-slip__meta">{INSPECTION.detail}</p>
    <div className="fp-slip__foot">
      <span>Application</span>
      <strong>{INSPECTION.ref}</strong>
    </div>
  </div>
);
