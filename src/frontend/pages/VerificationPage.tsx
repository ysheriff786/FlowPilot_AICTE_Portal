import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCheck,
  FileText,
  Loader2,
  Upload,
  XCircle,
  Layers,
} from 'lucide-react';
import api, { openDocument, getErrorMessage } from '../services/api';
import { useAuth } from '../context/AuthContext';
import type {
  ApplicationDocument,
  ApplicationSummary,
  ComplianceData,
  DocStatus,
} from '../services/types';
import { COMMON_DOC_TYPES } from '../lib/workflow';
import {
  EmptyState,
  ErrorBanner,
  Field,
  LoadingBlock,
  Modal,
  PageHeader,
  StatusBadge,
  formatDate,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui';

export const VerificationPage: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [applicationId, setApplicationId] = useState(searchParams.get('application') || '');
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [requirements, setRequirements] = useState<{ id: string; docType: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('Application Form');
  const [verifyTarget, setVerifyTarget] = useState<ApplicationDocument | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<DocStatus>('APPROVED');
  const [verifyComment, setVerifyComment] = useState('');
  const [verifying, setVerifying] = useState(false);

  const canUpload = user?.role === 'ADMIN' || user?.role === 'COLLEGE';
  const canVerify = user?.role === 'ADMIN' || user?.role === 'OFFICER';
  const application = applications.find((entry) => entry.id === applicationId) || null;

  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<ApplicationSummary[]>('/applications');
      setApplications(response.data);
      const requested = searchParams.get('application');
      const selection =
        response.data.find((entry) => entry.id === requested)?.id || response.data[0]?.id || '';
      setApplicationId(selection);
      if (selection && selection !== requested) {
        setSearchParams({ application: selection }, { replace: true });
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load applications'));
    } finally {
      setLoading(false);
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    loadApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDocuments = useCallback(async (id: string, category?: string) => {
    if (!id) {
      setDocuments([]);
      setCompliance(null);
      return;
    }
    setDocsLoading(true);
    try {
      const [documentsResponse, complianceResponse] = await Promise.all([
        api.get<ApplicationDocument[]>(`/documents/application/${id}`),
        api.get<ComplianceData>(`/documents/compliance/${id}`),
      ]);
      setDocuments(documentsResponse.data);
      setCompliance(complianceResponse.data);

      if (category) {
        const requirementsResponse = await api.get<{ id: string; docType: string }[]>(
          '/documents/requirements',
          { params: { category } }
        );
        setRequirements(requirementsResponse.data);
        if (requirementsResponse.data.length > 0) {
          setDocType(requirementsResponse.data[0].docType);
        }
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load documents'));
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!applicationId) {
      setDocuments([]);
      setCompliance(null);
      return;
    }
    loadDocuments(applicationId, application?.category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, application?.category]);

  const docTypeOptions = useMemo(() => {
    const required = requirements.map((requirement) => requirement.docType);
    const existing = documents.map((document) => document.docType);
    return [...new Set([...required, ...COMMON_DOC_TYPES, ...existing])];
  }, [requirements, documents]);

  const handleUpload = async () => {
    if (!selectedFile || !application) {
      setError('Choose an application and a file before uploading.');
      return;
    }

    setUploading(true);
    setError('');
    setNotice('');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('applicationId', application.id);
    formData.append('docType', docType);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setSelectedFile(null);
      const input = document.getElementById('fileInput') as HTMLInputElement | null;
      if (input) input.value = '';
      await loadDocuments(application.id, application.category);
      setNotice(`${docType} uploaded and queued for officer verification.`);
      window.dispatchEvent(new CustomEvent('flowpilot:notifications-changed'));
    } catch (err) {
      setError(getErrorMessage(err, 'Upload failed. Use a PDF, JPG or PNG under 5 MB.'));
    } finally {
      setUploading(false);
    }
  };

  const openVerify = (document: ApplicationDocument, status: DocStatus) => {
    setVerifyTarget(document);
    setVerifyStatus(status);
    setVerifyComment(document.officerComment || '');
  };

  const submitVerification = async () => {
    if (!verifyTarget) return;
    setVerifying(true);
    setError('');
    try {
      await api.patch(`/documents/verify/${verifyTarget.id}`, {
        status: verifyStatus,
        officerComment: verifyComment.trim() || undefined,
      });
      setVerifyTarget(null);
      await loadDocuments(verifyTarget.applicationId, application?.category);
      setNotice(`${verifyTarget.docType} marked ${verifyStatus.replaceAll('_', ' ').toLowerCase()}.`);
      window.dispatchEvent(new CustomEvent('flowpilot:notifications-changed'));
    } catch (err) {
      setError(getErrorMessage(err, 'Could not verify the document'));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return <LoadingBlock label="Loading verification studio..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Verification Studio"
        subtitle={
          application
            ? `Upload and verify statutory documents for ${application.refId}.`
            : 'Upload and verify statutory documents for institutional approval.'
        }
        actions={
          applications.length > 0 ? (
            <select
              aria-label="Application"
              value={applicationId}
              onChange={(event) => {
                const next = event.target.value;
                setApplicationId(next);
                setSearchParams({ application: next }, { replace: true });
              }}
              className={`${inputClass} sm:w-72`}
            >
              {applications.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.refId} — {entry.institution.name}
                </option>
              ))}
            </select>
          ) : undefined
        }
      />

      {error && <ErrorBanner message={error} />}
      {notice && (
        <div className="p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg">
          {notice}
        </div>
      )}

      {!application ? (
        <div className="bg-white rounded-2xl border border-slate-200">
          <EmptyState
            icon={Layers}
            title="No application available"
            description={
              user?.role === 'COLLEGE'
                ? 'Create an application first, then upload the required documents here.'
                : 'No applications are assigned to you yet.'
            }
          />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryTile label="Approved" value={compliance?.approvedCount ?? 0} tone="emerald" />
            <SummaryTile label="Pending" value={compliance?.pendingCount ?? 0} tone="slate" />
            <SummaryTile label="Corrections" value={compliance?.correctionCount ?? 0} tone="amber" />
            <SummaryTile label="Rejected" value={compliance?.rejectedCount ?? 0} tone="red" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {canUpload && (
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <Upload size={18} className="text-blue-600" /> Upload Document
                  </h3>
                  <div className="space-y-4">
                    <Field label="Document Type">
                      <select
                        value={docType}
                        onChange={(event) => setDocType(event.target.value)}
                        className={inputClass}
                      >
                        {docTypeOptions.map((option) => (
                          <option key={option}>{option}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Select File" hint="PDF, JPG or PNG up to 5 MB.">
                      <div className="relative">
                        <input
                          type="file"
                          className="hidden"
                          id="fileInput"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                        />
                        <label
                          htmlFor="fileInput"
                          className="flex flex-col items-center justify-center w-full p-6 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        >
                          <Upload size={24} className="text-slate-500 mb-2" />
                          <span className="text-xs text-slate-500 text-center px-2">
                            {selectedFile ? selectedFile.name : 'Click to upload PDF or image'}
                          </span>
                        </label>
                      </div>
                    </Field>

                    <button
                      onClick={handleUpload}
                      disabled={!selectedFile || uploading}
                      className={`${primaryButtonClass} w-full`}
                    >
                      {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                      {uploading ? 'Uploading...' : 'Submit for Verification'}
                    </button>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900 mb-2">Compliance score</h3>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-slate-900">{compliance?.score ?? 0}%</span>
                    <span className="text-xs text-slate-500 mb-1">
                      {compliance?.approvedCount ?? 0}/{compliance?.totalRequired ?? 0} required
                    </span>
                  </div>
                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        (compliance?.score ?? 0) >= 80
                          ? 'bg-emerald-500'
                          : (compliance?.score ?? 0) >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${compliance?.score ?? 0}%` }}
                    />
                  </div>
                  {compliance?.missingRequired.length ? (
                    <p className="text-xs text-amber-700 mt-3">
                      Missing: {compliance.missingRequired.slice(0, 3).join(', ')}
                      {compliance.missingRequired.length > 3 ? '…' : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-emerald-700 mt-3">All required documents approved.</p>
                  )}
                </div>
              </div>
            )}

            <div className={`${canUpload ? 'lg:col-span-2' : 'lg:col-span-3'} space-y-4`}>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center gap-2">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <FileCheck size={18} className="text-blue-600" /> Verification Checklist
                  </h3>
                  <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded whitespace-nowrap">
                    {documents.filter((document) => document.status === 'APPROVED').length} /{' '}
                    {compliance?.totalRequired ?? 10} approved
                  </span>
                </div>

                {docsLoading ? (
                  <div className="flex items-center justify-center gap-2 h-40 text-slate-500">
                    <Loader2 size={18} className="animate-spin" /> Loading documents...
                  </div>
                ) : documents.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="No documents uploaded yet"
                    description={
                      canUpload
                        ? 'Use the upload panel to add the first statutory document.'
                        : 'The institution has not uploaded documents for this application.'
                    }
                  />
                ) : (
                  <div className="divide-y divide-slate-100">
                    {documents.map((document) => (
                      <div
                        key={document.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText size={18} className="text-slate-500 shrink-0" aria-hidden="true" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 truncate">{document.docType}</p>
                            <p className="text-xs text-slate-500 truncate">
                              {document.officerComment || 'Awaiting officer review'} · {formatDate(document.uploadDate)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <StatusBadge status={document.status} />
                          <button
                            type="button"
                            onClick={() => openDocument(document.id)}
                            className="text-xs font-bold text-blue-600 hover:underline px-1"
                          >
                            View
                          </button>
                          {canVerify && (
                            <div className="flex items-center gap-1 ml-1">
                              <button
                                onClick={() => openVerify(document, 'APPROVED')}
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-md"
                                title="Approve"
                                aria-label={`Approve ${document.docType}`}
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <button
                                onClick={() => openVerify(document, 'CORRECTION_REQUIRED')}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-md"
                                title="Request correction"
                                aria-label={`Request correction for ${document.docType}`}
                              >
                                <AlertCircle size={16} />
                              </button>
                              <button
                                onClick={() => openVerify(document, 'REJECTED')}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                                title="Reject"
                                aria-label={`Reject ${document.docType}`}
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {documents.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 p-4">
                  <h3 className="text-sm font-bold text-slate-900 mb-3">Required documents still missing</h3>
                  {compliance?.missingRequired.length ? (
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {compliance.missingRequired.map((item) => (
                        <li key={item} className="flex items-center gap-2 text-xs text-slate-600">
                          <Clock size={13} className="text-amber-500 shrink-0" /> {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-emerald-700">Every required document has been approved.</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Modal
        open={Boolean(verifyTarget)}
        onClose={() => setVerifyTarget(null)}
        title={verifyTarget ? verifyTarget.docType : 'Verify document'}
        description="Record your verification decision and an optional comment for the institution."
        footer={
          <>
            <button onClick={() => setVerifyTarget(null)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button onClick={submitVerification} disabled={verifying} className={primaryButtonClass}>
              {verifying && <Loader2 size={16} className="animate-spin" />}
              Save decision
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(['APPROVED', 'CORRECTION_REQUIRED', 'REJECTED'] as DocStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => setVerifyStatus(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  verifyStatus === status
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {status.replaceAll('_', ' ')}
              </button>
            ))}
          </div>
          <Field label="Officer comment">
            <textarea
              value={verifyComment}
              onChange={(event) => setVerifyComment(event.target.value)}
              className={`${inputClass} min-h-[100px]`}
              placeholder="Optional remarks visible to the institution"
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
};

const SummaryTile = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'emerald' | 'slate' | 'amber' | 'red';
}) => {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
  };
  return (
    <div className={`p-4 rounded-xl border border-transparent ${tones[tone]}`}>
      <p className="text-xs font-bold">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
};
