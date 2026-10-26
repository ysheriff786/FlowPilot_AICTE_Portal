import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  FileText,
  History,
  Send,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import api, { openDocument, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { ApplicationDetail, AppStatus } from '../services/types';
import { allowedTransitions, STATUS_LABELS } from '../lib/workflow';
import {
  EmptyState,
  ErrorBanner,
  Field,
  Modal,
  Spinner,
  StatusBadge,
  dangerButtonClass,
  formatDate,
  formatDateTime,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from './ui';

export const ApplicationDetailModal: React.FC<{
  applicationId: string | null;
  onClose: () => void;
  onChanged?: () => void;
}> = ({ applicationId, onClose, onChanged }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<AppStatus | ''>('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!applicationId) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApplicationDetail>(`/applications/${applicationId}`);
      setDetail(response.data);
      setStatus('');
      setComment('');
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load this application'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  if (!applicationId) return null;

  const transitions = detail ? allowedTransitions(user?.role, detail.status) : [];
  const canSubmit =
    user?.role === 'COLLEGE' &&
    detail &&
    ['DRAFT', 'CORRECTION_REQUIRED'].includes(detail.status);

  const changeStatus = async () => {
    if (!detail || !status) return;
    setSaving(true);
    setError('');
    try {
      await api.patch(`/applications/${detail.id}/status`, { status, comment: comment.trim() || undefined });
      await load();
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update the status'));
    } finally {
      setSaving(false);
    }
  };

  const submitApplication = async () => {
    if (!detail) return;
    setSaving(true);
    setError('');
    try {
      await api.post(`/applications/${detail.id}/submit`);
      await load();
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not submit the application'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(applicationId)}
      onClose={onClose}
      title={detail ? detail.refId : 'Application details'}
      description={detail ? `${detail.institution.name} · ${detail.category} · ${detail.academicYear}` : undefined}
      size="xl"
      footer={
        <>
          <button onClick={onClose} className={secondaryButtonClass}>
            Close
          </button>
          {detail && (
            <button
              onClick={() => {
                onClose();
                navigate(`/verification?application=${detail.id}`);
              }}
              className={primaryButtonClass}
            >
              <FileText size={16} /> Documents
            </button>
          )}
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 h-40 text-slate-500">
          <Spinner /> Loading application...
        </div>
      ) : error && !detail ? (
        <ErrorBanner message={error} onRetry={load} />
      ) : detail ? (
        <div className="space-y-6">
          {error && <ErrorBanner message={error} />}

          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={detail.status} />
            <span className="text-xs text-slate-500">
              Submitted {formatDate(detail.submissionDate)} · Deadline {formatDate(detail.deadline)}
            </span>
            {detail.assignedOfficer && (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <UserCheck size={13} /> {detail.assignedOfficer.name}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoTile label="Documents" value={String(detail.documents.length)} icon={FileText} />
            <InfoTile
              label="Verified"
              value={String(detail.documents.filter((doc) => doc.status === 'APPROVED').length)}
              icon={ShieldCheck}
            />
            <InfoTile label="Reviews" value={String(detail.reviews.length)} icon={ClipboardList} />
            <InfoTile label="Inspections" value={String(detail.inspections.length)} icon={Calendar} />
          </div>

          {canSubmit && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
              <div>
                <p className="text-sm font-bold text-blue-900">Ready to submit?</p>
                <p className="text-xs text-blue-700">
                  Submitting locks the draft and routes it to an AICTE officer for scrutiny.
                </p>
              </div>
              <button onClick={submitApplication} disabled={saving} className={primaryButtonClass}>
                {saving ? <Spinner /> : <Send size={16} />}
                {detail.status === 'CORRECTION_REQUIRED' ? 'Resubmit' : 'Submit'}
              </button>
            </div>
          )}

          {transitions.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <p className="text-sm font-bold text-slate-900">Workflow action</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Move to status">
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as AppStatus)}
                    className={inputClass}
                  >
                    <option value="">Select next status</option>
                    {transitions.map((value) => (
                      <option key={value} value={value}>
                        {STATUS_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Comment (optional)">
                  <input
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    className={inputClass}
                    placeholder="Remarks for the institution"
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={changeStatus}
                  disabled={!status || saving}
                  className={
                    status === 'REJECTED' ? dangerButtonClass : primaryButtonClass
                  }
                >
                  {saving ? <Spinner /> : <CheckCircle2 size={16} />}
                  Apply status change
                </button>
              </div>
            </div>
          )}

          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" /> Documents
            </h3>
            {detail.documents.length === 0 ? (
              <div className="border border-dashed border-slate-200 rounded-xl">
                <EmptyState title="No documents uploaded" description="Use the verification studio to upload statutory documents." />
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                {detail.documents.map((doc) => (
                  <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{doc.docType}</p>
                      <p className="text-xs text-slate-500 truncate">
                        Uploaded {formatDate(doc.uploadDate)}
                        {doc.officerComment ? ` · ${doc.officerComment}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <StatusBadge status={doc.status} withIcon={false} />
                      <button
                        type="button"
                        onClick={() => openDocument(doc.id)}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <History size={16} className="text-blue-600" /> Review history
            </h3>
            {detail.reviews.length === 0 ? (
              <p className="text-sm text-slate-500">No review comments yet.</p>
            ) : (
              <ol className="space-y-3">
                {detail.reviews.map((review) => (
                  <li key={review.id} className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-800">{review.comment}</p>
                      <p className="text-xs text-slate-500">
                        {review.officer?.name || 'System'} · {formatDateTime(review.createdAt)}
                        {review.statusChange ? ` · ${review.statusChange.replaceAll('_', ' ')}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {detail.inspections.length > 0 && (
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-blue-600" /> Inspections
              </h3>
              <div className="space-y-2">
                {detail.inspections.map((inspection) => (
                  <div key={inspection.id} className="p-3 bg-slate-50 rounded-lg flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {formatDateTime(inspection.inspectionDate)} · {inspection.location}
                      </p>
                      {inspection.notes && <p className="text-xs text-slate-500">{inspection.notes}</p>}
                    </div>
                    <StatusBadge status={inspection.status} withIcon={false} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

const InfoTile: React.FC<{ label: string; value: string; icon: React.ElementType }> = ({
  label,
  value,
  icon: Icon,
}) => (
  <div className="p-3 bg-slate-50 rounded-xl">
    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mb-1">
      <Icon size={12} /> {label}
    </div>
    <p className="text-xl font-bold text-slate-900">{value}</p>
  </div>
);
