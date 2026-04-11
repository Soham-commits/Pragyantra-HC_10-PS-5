import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, FileText, MessageSquare, Stethoscope, AlertCircle, ChevronRight, Calendar, Clock } from 'lucide-react';
import { cn } from '@/utils';

export interface MedicalHistoryEntry {
  id: string;
  entry_type: 'chatbot_screening' | 'scan_analysis' | 'medical_report' | 'doctor_visit';
  title: string;
  summary: string;
  risk_level: 'low' | 'moderate' | 'high' | 'critical' | 'none';
  created_at: string;
  metadata?: Record<string, any>;
  doctor_id?: string;
  related_report_id?: string;
}

export interface ScanReviewSummary {
  review_status?: 'pending' | 'reviewed';
  reviewed_by_doctor?: boolean | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
}

interface TimelineEntryCardProps {
  entry: MedicalHistoryEntry;
  scanReview?: ScanReviewSummary | null;
  referral?: any;
  onClick?: () => void;
}

const entryTypeConfig = {
  chatbot_screening: {
    icon: MessageSquare,
    label: 'Symptom Check',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  scan_analysis: {
    icon: Activity,
    label: 'Scan Analysis',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  medical_report: {
    icon: FileText,
    label: 'Medical Report',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  doctor_visit: {
    icon: Stethoscope,
    label: 'Doctor Visit',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
};

const riskLevelConfig = {
  none: { 
    label: 'Normal', 
    color: 'bg-gray-50 text-gray-600',
  },
  low: { 
    label: 'Low Risk', 
    color: 'bg-green-50 text-green-600',
  },
  moderate: { 
    label: 'Moderate', 
    color: 'bg-yellow-50 text-yellow-600',
  },
  high: { 
    label: 'High Risk', 
    color: 'bg-orange-50 text-orange-600',
  },
  critical: { 
    label: 'Critical', 
    color: 'bg-red-50 text-red-600',
  },
};

export const TimelineEntryCard: React.FC<TimelineEntryCardProps> = ({ entry, scanReview, referral, onClick }) => {
  const typeConfig = entryTypeConfig[entry.entry_type];
  const riskConfig = riskLevelConfig[entry.risk_level];
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
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  const getTime = (dateString: string) => {
    const date = parseDateValue(dateString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const borderColor = 
    entry.risk_level === 'critical' ? 'border-l-red-500' :
    entry.risk_level === 'high' ? 'border-l-orange-500' :
    entry.risk_level === 'moderate' ? 'border-l-yellow-500' :
    'border-l-gray-200';

  const formatReviewDate = (value?: string | null) => {
    if (!value) return '';
    const date = parseDateValue(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const reviewDateLabel = formatReviewDate(scanReview?.reviewed_at);
  const reviewerName = scanReview?.reviewed_by_name?.trim()
    || (scanReview?.reviewed_by_doctor ? "Doctor" : "");
  const isReviewed = Boolean(
    scanReview?.review_status === 'reviewed' ||
    scanReview?.reviewed_by_doctor ||
    reviewerName
  );
  const reviewLabel = isReviewed
    ? `Reviewed${reviewerName ? ` Â· ${reviewerName}` : ''}${reviewDateLabel ? ` Â· ${reviewDateLabel}` : ''}`
    : 'Pending review';

  const reviewBadgeStyle = isReviewed
    ? 'bg-emerald-50 text-emerald-700'
    : 'bg-amber-50 text-amber-700';

  // Referral status
  const hasActiveReferral = referral && referral.status === 'active';
  const referralLabel = hasActiveReferral 
    ? `Referred to ${referral.specialist_name || 'Specialist'}`
    : null;

  return (
    <div className="relative pl-8 pb-6 last:pb-0 group">
      {/* Timeline vertical line */}
      <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gray-200 group-last:hidden" />
      
      {/* Timeline dot */}
      <div className={cn(
        'absolute left-0 top-3 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center transition-all',
        typeConfig.bg
      )}>
        <Icon className={cn('w-4 h-4', typeConfig.color)} />
      </div>

      {/* Card */}
      <Card
        className={cn(
          'transition-all hover:shadow-md cursor-pointer border-l-4 overflow-hidden bg-white',
          'border border-gray-200/60 hover:border-gray-300',
          borderColor
        )}
        onClick={onClick}
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold text-gray-900 mb-1">
                {entry.title}
              </CardTitle>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(entry.created_at)}</span>
                <span className="text-gray-300">â€¢</span>
                <Clock className="w-3 h-3" />
                <span>{getTime(entry.created_at)}</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
          </div>

          <p className="text-sm text-gray-600 mb-3 line-clamp-2">
            {entry.summary}
          </p>

          <div className="flex items-center flex-wrap gap-2">
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-medium px-2.5 py-1 border-transparent",
                typeConfig.bg,
                typeConfig.color
              )}
            >
              {typeConfig.label}
            </Badge>
            {entry.risk_level !== 'none' && (
              <Badge
                variant="outline"
                className={cn(
                  'text-xs font-medium px-2.5 py-1 border-transparent',
                  riskConfig.color
                )}
              >
                {riskConfig.label}
              </Badge>
            )}
            {entry.entry_type === 'scan_analysis' && scanReview && (
              <Badge
                variant="outline"
                className={cn('text-xs font-medium px-2.5 py-1 border-transparent', reviewBadgeStyle)}
              >
                {reviewLabel}
              </Badge>
            )}
            {entry.entry_type === 'scan_analysis' && hasActiveReferral && (
              <Badge
                variant="outline"
                className="text-xs font-medium px-2.5 py-1 border-transparent bg-blue-50 text-blue-700"
              >
                {referralLabel}
              </Badge>
            )}
            {entry.metadata?.symptoms && entry.metadata.symptoms.length > 0 && (
              <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full border border-gray-200/60">
                <AlertCircle className="w-3 h-3 text-gray-600" />
                <span className="text-xs text-gray-600 font-medium">
                  {entry.metadata.symptoms.length} symptom{entry.metadata.symptoms.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

interface TimelineProps {
  entries: MedicalHistoryEntry[];
  scanReviewMap?: Record<string, ScanReviewSummary>;
  referralMap?: Record<string, any>;
  onEntryClick?: (entry: MedicalHistoryEntry) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

export const MedicalTimeline: React.FC<TimelineProps> = ({
  entries,
  scanReviewMap,
  referralMap,
  onEntryClick,
  isLoading = false,
  emptyMessage = 'No medical history entries yet.',
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="relative pl-8 pb-6">
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gray-200" />
            <div className="absolute left-0 top-3 w-8 h-8 rounded-full bg-gray-200 animate-pulse border-2 border-white shadow-sm" />
            <Card className="animate-pulse border-l-4 border-l-gray-200 overflow-hidden border border-gray-200/60">
              <CardHeader className="pb-3">
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2 mb-3">
                  <div className="h-3 bg-gray-200 rounded w-full" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
                <div className="flex gap-2">
                  <div className="h-6 bg-gray-200 rounded-full w-20" />
                  <div className="h-6 bg-gray-200 rounded-full w-20" />
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <Card className="text-center py-16 border border-gray-200/60 bg-white">
        <CardContent>
          <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-10 h-10 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">No Medical History Yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            Your medical screenings, scans, and doctor visits will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Sort entries by date (newest first)
  const sortedEntries = [...entries].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="relative">
      {/* Start marker at the top */}
      <div className="relative pl-8 flex items-center gap-3 pb-6">
        <div className="absolute left-0 w-8 h-8 rounded-full bg-gray-50 border-2 border-white shadow-sm flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-gray-400" />
        </div>
        <span className="text-xs text-gray-500 font-medium">Beginning of medical history</span>
      </div>

      {/* Timeline container */}
      <div className="space-y-0">
        {sortedEntries.map((entry, index) => (
          <TimelineEntryCard
            key={entry.id}
            entry={entry}
            scanReview={entry.entry_type === 'scan_analysis' && entry.metadata?.scan_id
              ? scanReviewMap?.[entry.metadata.scan_id]
              : null}
            referral={entry.entry_type === 'scan_analysis' && entry.metadata?.scan_id
              ? referralMap?.[entry.metadata.scan_id]
              : undefined}
            onClick={() => onEntryClick?.(entry)}
          />
        ))}
      </div>
    </div>
  );
};

