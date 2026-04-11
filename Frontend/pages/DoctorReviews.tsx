import { useEffect, useState } from "react";
import { DoctorLayout } from "@/features/doctor/components/DoctorLayout";
import { cn } from "@/utils";
import { Link, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "@/services/api";

interface DoctorScanCase {
  scan_id: string;
  health_id: string;
  patient_name: string;
  scan_type: string;
  image_url: string;
  gradcam_url?: string | null;
  upload_date: string;
  prediction?: string | null;
  confidence?: number | null;
  model_result?: string | null;
  abnormal_probability?: number | null;
  malignant_probability?: number | null;
  review_status: "pending" | "reviewed";
  reviewed_by_doctor?: boolean | null;
  reviewed_by_name?: string | null;
  doctor_notes?: string | null;
  flagged_followup?: boolean | null;
}

const formatProbability = (item: DoctorScanCase) => {
  const directProb = item.abnormal_probability ?? item.malignant_probability;
  if (directProb !== null && directProb !== undefined) {
    return `${directProb.toFixed(1)}%`;
  }
  if (item.confidence !== null && item.confidence !== undefined) {
    const normalized = item.confidence > 1 ? item.confidence : item.confidence * 100;
    return `${normalized.toFixed(1)}%`;
  }
  return "N/A";
};

const isAbnormal = (item: DoctorScanCase) => {
  const modelResult = (item.model_result || "").toLowerCase();
  if (modelResult === "abnormal" || modelResult === "malignant") {
    return true;
  }
  const prediction = (item.prediction || "").toLowerCase();
  return prediction.includes("abnormal") || prediction.includes("malignant");
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export default function DoctorReviews() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter');
  const [activeFilter, setActiveFilter] = useState<string>(filter || 'all');
  const [cases, setCases] = useState<DoctorScanCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchQuery = (searchParams.get("q") || "").trim().toLowerCase();
  const filteredCases = cases.filter((item) => {
    if (!searchQuery) return true;
    const haystack = [
      item.patient_name,
      item.health_id,
      item.scan_id,
      item.prediction ?? "",
      item.scan_type,
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(searchQuery);
  });

  useEffect(() => {
    const fetchCases = async () => {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("limit", "50");
      if (activeFilter === 'pending') params.set("pending_only", "true");
      else if (activeFilter === 'reviewed') params.set("reviewed_only", "true");
      else if (activeFilter === 'followup') params.set("followup_only", "true");

      try {
        const response = await fetchWithAuth(`/api/doctor/scans?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Failed to load scans");
        }
        const data = await response.json();
        setCases(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scans");
      } finally {
        setLoading(false);
      }
    };

    fetchCases();
  }, [activeFilter]);

  const handleFilterChange = (newFilter: string) => {
    setActiveFilter(newFilter);
    const newParams = new URLSearchParams(searchParams);
    if (newFilter === 'all') {
      newParams.delete('filter');
    } else {
      newParams.set('filter', newFilter);
    }
    setSearchParams(newParams);
  };

  return (
    <DoctorLayout title="Screening Reviews" showSearch>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Screening cases</h2>
          <p className="text-xs text-gray-500">Review recent screenings and add remarks</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-all",
              activeFilter === 'all'
                ? "bg-blue-50 text-blue-700 border-blue-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            All Cases
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('pending')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-all",
              activeFilter === 'pending'
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            Pending Reviews
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('reviewed')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-all",
              activeFilter === 'reviewed'
                ? "bg-green-50 text-green-700 border-green-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            Reviewed
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('followup')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border transition-all",
              activeFilter === 'followup'
                ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
            )}
          >
            Follow-ups
          </button>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-100 bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-gray-500 border-b border-gray-100">
            <tr>
              <th className="px-6 py-3 font-medium">Patient</th>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Prediction</th>
              <th className="px-6 py-3 font-medium">Probability</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-6 py-6 text-gray-500" colSpan={6}>
                  Loading screening cases...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td className="px-6 py-6 text-rose-600" colSpan={6}>
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filteredCases.length === 0 && (
              <tr>
                <td className="px-6 py-6 text-gray-500" colSpan={6}>
                  {searchQuery ? "No matching cases found." : "No screening cases found."}
                </td>
              </tr>
            )}
            {!loading && !error && filteredCases.map((item) => (
              <tr key={item.scan_id} className="border-b border-gray-50">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{item.patient_name}</div>
                  <div className="text-xs text-gray-500">{item.health_id}</div>
                </td>
                <td className="px-6 py-4 text-gray-600">{formatDate(item.upload_date)}</td>
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      "px-3 py-1 rounded-full text-xs font-medium",
                      isAbnormal(item)
                        ? "bg-rose-50 text-rose-700"
                        : "bg-emerald-50 text-emerald-700"
                    )}
                  >
                    {item.prediction || (isAbnormal(item) ? "Abnormal" : "Normal")}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600">{formatProbability(item)}</td>
                <td className="px-6 py-4">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      item.flagged_followup
                        ? "text-indigo-600"
                        : item.review_status === "pending"
                          ? "text-amber-600"
                          : "text-emerald-600"
                    )}
                  >
                    {item.flagged_followup
                      ? "Follow-up"
                      : item.review_status === "pending"
                        ? "Pending"
                        : "Reviewed"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    to={`/doctor/reviews/${item.scan_id}`}
                    className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DoctorLayout>
  );
}

