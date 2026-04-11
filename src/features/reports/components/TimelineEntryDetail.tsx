import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, FileText, MessageSquare, Stethoscope, Calendar, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils';
import type { MedicalHistoryEntry } from './MedicalTimeline';
import { API_BASE_URL, fetchWithAuth } from '@/services/api';

interface TimelineEntryDetailProps {
  entry: MedicalHistoryEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ScanReviewDetail {
  review_status?: 'pending' | 'reviewed';
  reviewed_by_doctor?: boolean | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  doctor_notes?: string | null;
  image_url?: string | null;
  gradcam_url?: string | null;
}

interface ReferralDetail {
  referral_id: string;
  status: string;
  specialist_name?: string;
  external_specialist?: { name: string };
  clinical_notes?: string;
  priority?: string;
  created_at?: string;
}

const entryTypeConfig = {
  chatbot_screening: {
    icon: MessageSquare,
    label: 'Symptom Check',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
  },
  scan_analysis: {
    icon: Activity,
    label: 'Scan Analysis',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
  },
  medical_report: {
    icon: FileText,
    label: 'Medical Report',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
  },
  doctor_visit: {
    icon: Stethoscope,
    label: 'Doctor Visit',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
  },
};

const riskLevelConfig = {
  none: { label: 'Normal', color: 'bg-gray-100 text-gray-700', icon: 'âœ“' },
  low: { label: 'Low Risk', color: 'bg-green-100 text-green-700', icon: 'âœ“' },
  moderate: { label: 'Moderate Risk', color: 'bg-yellow-100 text-yellow-700', icon: 'âš ' },
  high: { label: 'High Risk', color: 'bg-orange-100 text-orange-700', icon: 'âš ' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700', icon: 'ðŸš¨' },
};

export const TimelineEntryDetail: React.FC<TimelineEntryDetailProps> = ({ entry, open, onOpenChange }) => {
  const [scanReview, setScanReview] = useState<ScanReviewDetail | null>(null);
  const [scanReviewLoading, setScanReviewLoading] = useState(false);
  const [scanReviewError, setScanReviewError] = useState("");
  const [showGradCamInfo, setShowGradCamInfo] = useState(false);
  const [referral, setReferral] = useState<ReferralDetail | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);

  useEffect(() => {
    const scanId = entry?.metadata?.scan_id;
    if (!entry || entry.entry_type !== 'scan_analysis' || !scanId) {
      setScanReview(null);
      setScanReviewError("");
      setReferral(null);
      return;
    }

    let cancelled = false;
    const fetchScanReview = async () => {
      setScanReviewLoading(true);
      setScanReviewError("");

      try {
        const response = await fetchWithAuth(`/api/patient/scans/${scanId}`);

        if (!response.ok) {
          throw new Error("Failed to load scan review");
        }

        const data = await response.json();
        if (!cancelled) {
          setScanReview({
            review_status: data.review_status,
            reviewed_by_doctor: data.reviewed_by_doctor,
            reviewed_by_name: data.reviewed_by_name,
            reviewed_at: data.reviewed_at,
            doctor_notes: data.doctor_notes,
            image_url: data.image_url,
            gradcam_url: data.gradcam_url,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setScanReviewError(err instanceof Error ? err.message : "Failed to load scan review");
        }
      } finally {
        if (!cancelled) {
          setScanReviewLoading(false);
        }
      }
    };

    const fetchReferral = async () => {
      setReferralLoading(true);
      try {
        const profileResponse = await fetchWithAuth('/api/auth/profile');
        if (!profileResponse.ok) return;

        const profileData = await profileResponse.json();
        if (!profileData.health_id) return;

        const referralsResponse = await fetchWithAuth(`/api/referrals/patient/${profileData.health_id}`);
        if (referralsResponse.ok) {
          const referrals = await referralsResponse.json();
          const matchingReferral = referrals.find((ref: any) => ref.source_scan_id === scanId);
          if (!cancelled && matchingReferral) {
            setReferral(matchingReferral);
          }
        }
      } catch (err) {
        console.error("Error fetching referral:", err);
      } finally {
        if (!cancelled) {
          setReferralLoading(false);
        }
      }
    };

    fetchScanReview();
    fetchReferral();
    return () => {
      cancelled = true;
    };
  }, [entry]);

  if (!entry) return null;

  const typeConfig = entryTypeConfig[entry.entry_type] ?? entryTypeConfig.chatbot_screening;
  const riskConfig = riskLevelConfig[entry.risk_level] ?? riskLevelConfig.none;
  const Icon = typeConfig.icon;

  const parseDateValue = (value: string) => {
    const trimmed = value.trim();
    let normalized = trimmed;
    if (/^\d{4}-\d{2}-\d{2} /.test(normalized)) {
      normalized = normalized.replace(' ', 'T');
    }
    const hasTimezone = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized);
    if (!hasTimezone && /^\d{4}-\d{2}-\d{2}T/.test(normalized)) {
      normalized = `${normalized}Z`;
    }
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return new Date(trimmed);
  };

  const formatDate = (dateString: string) => {
    const date = parseDateValue(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const resolveImageUrl = (value?: string | null) => {
    if (!value) return '';
    if (value.startsWith('http')) return value;
    return `${API_BASE_URL}${value}`;
  };

  const isReviewed = Boolean(
    scanReview?.review_status === 'reviewed' ||
    scanReview?.reviewed_by_doctor ||
    scanReview?.reviewed_by_name
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>{entry.title}</DialogTitle>
          <DialogDescription>{formatDate(entry.created_at)}</DialogDescription>
        </DialogHeader>

        <div className="p-6">
          <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6 shadow-sm">
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-amber-100/60 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-sky-100/60 blur-3xl" />

            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className={cn('p-3 rounded-2xl bg-white/80 border border-white/60', typeConfig.bgColor)}>
                    <Icon className={cn('w-6 h-6', typeConfig.color)} />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Timeline entry</p>
                    <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">{entry.title}</h1>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(entry.created_at)}
                  </span>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1', typeConfig.bgColor, typeConfig.color)}>
                    {typeConfig.label}
                  </span>
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-3 py-1', riskConfig.color)}>
                    {riskConfig.icon} {riskConfig.label}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">{entry.summary}</p>
              </div>

              {entry.related_report_id && (
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Related report</p>
                  <p className="text-sm font-semibold text-slate-900">{entry.related_report_id}</p>
                  <p className="mt-1 text-xs text-slate-500">Reference ID</p>
                </div>
              )}
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">


              {entry.metadata?.symptoms && entry.metadata.symptoms.length > 0 && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Detected symptoms</h2>
                  <div className="grid gap-3 md:grid-cols-2">
                    {Array.from(
                      new Map(
                        entry.metadata.symptoms
                          .map((symptom: string) => symptom.trim())
                          .filter((symptom: string) => symptom.length > 0)
                          .map((symptom: string) => [symptom.toLowerCase(), symptom])
                      ).values()
                    ).map((symptom: string, index: number) => (
                      <div key={`${symptom}-${index}`} className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                        <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
                          <AlertCircle className="h-4 w-4" />
                          Symptom
                        </div>
                        <p className="mt-2 text-sm text-blue-900">{symptom}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {entry.metadata?.recommendations && entry.metadata.recommendations.length > 0 && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h2>
                  <div className="space-y-3">
                    {entry.metadata.recommendations.map((rec: string, index: number) => (
                      <div key={`${rec}-${index}`} className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <span className="text-emerald-700 font-semibold">{index + 1}</span>
                        <span className="text-sm text-emerald-900">{rec}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {entry.entry_type === 'scan_analysis' && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Scan visuals</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {/* Left Card: Original Scan */}
                    <div className="flex flex-col rounded-2xl border border-gray-100 bg-slate-50 p-4 h-full">
                      <p className="text-sm font-medium text-gray-900 mb-3">Original Scan</p>
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-100 bg-white">
                        {scanReview?.image_url ? (
                          <img
                            src={resolveImageUrl(scanReview.image_url)}
                            alt="Original scan"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gray-50 text-xs text-gray-400">
                            Image processing
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] text-gray-400">Uploaded diagnostic image</p>
                    </div>

                    {/* Right Card: Grad-CAM Visualization */}
                    <div className="flex flex-col rounded-2xl border border-gray-100 bg-slate-50 p-4 h-full">
                      <p className="text-sm font-medium text-gray-900 mb-3">Grad-CAM Visualization</p>
                      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-gray-100 bg-white">
                        {scanReview?.gradcam_url ? (
                          <img
                            src={resolveImageUrl(scanReview.gradcam_url)}
                            alt="Grad-CAM Visualization"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-50 text-xs text-gray-400">
                            <span>Grad-CAM processing</span>
                          </div>
                        )}
                      </div>
                      <p className="mt-2 text-[10px] text-gray-400">AI attention heatmap overlay</p>
                    </div>
                  </div>

                  {/* Full-width Interpretation Section */}
                  {scanReview?.gradcam_url && (
                    <div className="mt-6 border-t border-gray-100 pt-6">
                      <div className="rounded-xl border border-blue-50 bg-blue-50/30 p-4">
                        <h4 className="flex items-center gap-2 text-xs font-semibold text-gray-900 mb-3">
                          <Info className="h-3.5 w-3.5 text-blue-600" />
                          How to interpret this visualization
                        </h4>

                        {/* Legend Row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-3">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-gradient-to-br from-red-500 to-orange-500 shadow-sm" />
                            <span className="text-xs font-medium text-slate-700">High attention</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-yellow-400 shadow-sm" />
                            <span className="text-xs font-medium text-slate-700">Moderate</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 shadow-sm" />
                            <span className="text-xs font-medium text-slate-700">Low attention</span>
                          </div>
                        </div>

                        {/* Explanation Text */}
                        <p className="text-xs text-slate-600 leading-snug mb-3 max-w-3xl">
                          This visualization highlights areas the AI model focused on while analyzing your scan. It supports screening transparency but does not confirm diagnosis.
                        </p>

                        {/* Disclaimer Footer */}
                        <p className="text-[10px] text-slate-400 italic">
                          AI-assisted screening visualization â€” not a medical diagnosis.
                        </p>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Referral Status Section - Show if referral exists - MOVED TO LEFT COLUMN */}
              {entry.entry_type === 'scan_analysis' && referral && (
                <section className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-blue-900 mb-4">Referral Status</h2>
                  <div className="space-y-3">
                    <div className={cn(
                      'rounded-2xl border px-4 py-3 text-xs font-semibold',
                      referral.status === 'active'
                        ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                        : referral.status === 'pending'
                        ? 'border-amber-200 bg-amber-100 text-amber-800'
                        : 'border-gray-200 bg-gray-100 text-gray-800'
                    )}>
                      {referral.status === 'active' ? 'âœ“ Referral Accepted' : 
                       referral.status === 'pending' ? 'Pending Specialist Response' : 
                       referral.status.charAt(0).toUpperCase() + referral.status.slice(1)}
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
                      <p className="text-xs text-blue-600">Referred to</p>
                      <p className="text-sm font-semibold text-blue-900">
                        {referral.specialist_name || referral.external_specialist?.name || 'Specialist'}
                      </p>
                    </div>
                    {referral.priority && (
                      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
                        <p className="text-xs text-blue-600">Priority</p>
                        <p className={cn(
                          "text-sm font-semibold",
                          referral.priority === 'emergency' ? 'text-red-700' :
                          referral.priority === 'urgent' ? 'text-orange-700' :
                          'text-blue-900'
                        )}>
                          {referral.priority.charAt(0).toUpperCase() + referral.priority.slice(1)}
                        </p>
                      </div>
                    )}
                    {referral.clinical_notes && (
                      <div className="rounded-2xl border border-blue-100 bg-white px-4 py-3">
                        <p className="text-xs text-blue-600">Clinical notes</p>
                        <p className="mt-2 text-sm text-blue-900">
                          {referral.clinical_notes}
                        </p>
                      </div>
                    )}
                    {referral.status === 'active' && (
                      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                        <p className="text-xs text-emerald-700 font-semibold">Next Steps</p>
                        <p className="mt-2 text-sm text-emerald-900">
                          The specialist has accepted your referral and will review your case. You may be contacted for further consultation.
                        </p>
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Entry type</p>
                    <p className="text-sm font-semibold text-slate-900">{typeConfig.label}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Risk level</p>
                    <p className="text-sm font-semibold text-slate-900">{riskConfig.label}</p>
                  </div>
                  {entry.entry_type === 'scan_analysis' && entry.metadata?.scan_type && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">Scan type</p>
                      <p className="text-sm font-semibold text-slate-900">{entry.metadata.scan_type}</p>
                    </div>
                  )}
                  {entry.entry_type === 'scan_analysis' && entry.metadata?.confidence && (
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                      <p className="text-xs text-slate-500">Confidence</p>
                      <p className="text-sm font-semibold text-slate-900">{(entry.metadata.confidence * 100).toFixed(1)}%</p>
                    </div>
                  )}
                </div>
              </section>

              {entry.entry_type === 'scan_analysis' && (
                <>
                  {/* Doctor Review Section - Only show if NOT referred or if reviewed */}
                  {(!referral || isReviewed) && (
                    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                      <h2 className="text-lg font-semibold text-gray-900 mb-4">Doctor review</h2>
                      {scanReviewLoading && (
                        <p className="text-sm text-gray-500">Loading review details...</p>
                      )}
                      {!scanReviewLoading && scanReviewError && (
                        <p className="text-sm text-rose-600">{scanReviewError}</p>
                      )}
                      {!scanReviewLoading && !scanReviewError && (
                        scanReview ? (
                          <div className="space-y-3">
                            <div className={cn(
                              'rounded-2xl border px-4 py-3 text-xs font-semibold',
                              isReviewed
                                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                : 'border-amber-100 bg-amber-50 text-amber-700'
                            )}>
                              {isReviewed ? 'Reviewed' : 'Pending review'}
                            </div>
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                              <p className="text-xs text-gray-500">Reviewed by</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {scanReview.reviewed_by_name
                                  ? `Dr. ${scanReview.reviewed_by_name.replace(/^(Dr\.?\s*)/i, '')}`
                                  : scanReview.reviewed_by_doctor
                                    ? 'Doctor'
                                    : 'Not assigned'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                              <p className="text-xs text-gray-500">Reviewed at</p>
                              <p className="text-sm font-semibold text-gray-900">
                                {scanReview.reviewed_at ? formatDate(scanReview.reviewed_at) : 'Not reviewed yet'}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                              <p className="text-xs text-gray-500">Doctor remarks</p>
                              <p className="mt-2 text-sm text-gray-700">
                                {scanReview.doctor_notes || 'No remarks added yet.'}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">Review details are not available yet.</p>
                        )
                      )}
                    </section>
                  )}
                </>
              )}

              {entry.entry_type === 'doctor_visit' && entry.metadata && (
                <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Doctor visit</h2>
                  <div className="space-y-3">
                    {entry.metadata.diagnosis && (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                        <p className="text-xs text-amber-700 font-semibold">Diagnosis</p>
                        <p className="mt-2 text-sm text-amber-900">{entry.metadata.diagnosis}</p>
                      </div>
                    )}
                    {entry.metadata.treatment && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <p className="text-xs text-emerald-700 font-semibold">Treatment</p>
                        <p className="mt-2 text-sm text-emerald-900">{entry.metadata.treatment}</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Entry reference</h2>
                <p className="text-xs text-gray-500">Entry ID</p>
                <p className="text-sm font-semibold text-gray-900">{entry.id}</p>
              </section>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

