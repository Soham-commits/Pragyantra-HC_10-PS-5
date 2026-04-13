import { useState, useEffect, useRef } from "react";
import { fetchWithAuth } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, SendHorizonal, UserPlus, Search, X } from "lucide-react";
import { cn } from "@/utils";
import { Avatar as UserAvatar } from "@/components/Avatar";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Scan {
  scan_id: string;
  scan_type: string;
  upload_date: string;
  prediction?: string;
  referral_triggered?: boolean;
  referral_id?: string | null;
}

interface SpecialistResult {
  specialist_id: string;
  name: string;
  specialty: string;
  hospital_name: string;
  city: string;
  country: string;
  contact: string;
  is_registered: boolean;
  photo_url?: string | null;
}

interface ReferralRecord {
  referral_id: string;
  status: string;
  priority: string;
  specialist_id?: string | null;
  external_specialist?: { name: string; specialty: string; contact: string } | null;
  created_at: string;
}

export interface ReferralPanelProps {
  patientId: string; // health_id â€” used as patient_id in POST /referrals/create
  scans: Scan[];     // if empty the panel is not rendered at all
  prefillSpecialistName?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100  text-amber-700  border-amber-200" },
  active: { label: "Active", className: "bg-blue-100   text-blue-700   border-blue-200" },
  pending_registration: { label: "Awaiting Registration", className: "bg-gray-100 text-gray-700 border-gray-200" },
  rerouted: { label: "Rerouted", className: "bg-orange-100 text-orange-700 border-orange-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  declined: { label: "Declined", className: "bg-red-100    text-red-700    border-red-200" },
};

const SCAN_TYPE_LABEL: Record<string, string> = {
  "x-ray": "X-Ray",
  "skin": "Skin Scan",
  "mri": "MRI",
  "ct-scan": "CT Scan",
  "other": "Other",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReferralPanel({ patientId, scans, prefillSpecialistName }: ReferralPanelProps) {
  // Rule from briefing: if patient has zero scans, panel is not rendered at all
  if (scans.length === 0) return null;

  const [isOpen, setIsOpen] = useState(false);

  // Scan selection
  const [selectedScanId, setSelectedScanId] = useState(scans.length === 1 ? scans[0].scan_id : "");

  // Specialist search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpecialistResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suggestions
  const [suggestions, setSuggestions] = useState<SpecialistResult[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  // Specialist selection
  const [selectedSpecialist, setSelectedSpecialist] = useState<SpecialistResult | null>(null);

  // External specialist form â€” always available, not a fallback
  const [showExternalForm, setShowExternalForm] = useState(false);
  const [extName, setExtName] = useState("");
  const [extSpecialty, setExtSpecialty] = useState("");
  const [extContact, setExtContact] = useState("");

  // Referral form
  const [priority, setPriority] = useState("routine");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Existing referral for the selected scan (scan-scoped, not patient-scoped)
  const [existingReferral, setExistingReferral] = useState<ReferralRecord | null>(null);
  const [loadingReferral, setLoadingReferral] = useState(false);

  // ---------------------------------------------------------------------------
  // Scan-scoped referral check
  // When the selected scan changes, check THAT scan's referral_triggered flag.
  // Only if true do we fetch the referral list and find the matching record.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    setExistingReferral(null);
    if (!selectedScanId) return;

    const scan = scans.find((s) => s.scan_id === selectedScanId);
    if (!scan?.referral_triggered || !scan?.referral_id) return;

    // This scan already has a referral â€” fetch and filter to the specific one
    setLoadingReferral(true);
    fetchWithAuth(`/api/referrals/patient/${patientId}`)
      .then((r) => r.json())
      .then((referrals: ReferralRecord[]) => {
        const match = referrals.find((r) => r.referral_id === scan.referral_id);
        setExistingReferral(match ?? null);
      })
      .catch(() => setExistingReferral(null))
      .finally(() => setLoadingReferral(false));
  }, [selectedScanId, patientId, scans]);

  // ---------------------------------------------------------------------------
  // Load suggestions based on scan_type
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!selectedScanId) return;

    const scan = scans.find(s => s.scan_id === selectedScanId);
    if (!scan) return;

    const fetchSuggestions = async () => {
      setLoadingSuggestions(true);
      let special = "";
      const t = scan.scan_type.toLowerCase();
      if (t.includes("skin")) special = "Dermatology";
      else if (t.includes("chest") || t.includes("xray") || t.includes("x-ray")) special = "Pulmonology";
      else if (t.includes("mri") || t.includes("ct")) special = "Neurology";
      else special = "Oncology";

      try {
        const res = await fetchWithAuth(`/api/referrals/search?q=${special}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.slice(0, 3)); // top 3 suggestions
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [selectedScanId, scans]);

  // ---------------------------------------------------------------------------
  // Debounced specialist search (400 ms)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetchWithAuth(
          `/api/referrals/search?q=${encodeURIComponent(searchQuery)}`
        );
        const data: SpecialistResult[] = await res.json();
        setSearchResults(data);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!prefillSpecialistName) return;
    setSelectedSpecialist(null);
    setShowExternalForm(false);
    setSearchQuery(prefillSpecialistName);
  }, [prefillSpecialistName]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleSelectSpecialist = (s: SpecialistResult) => {
    setSelectedSpecialist(s);
    setSearchQuery(s.name);
    setShowDropdown(false);
    setShowExternalForm(false); // clear external form if they switch back
  };

  const handleClearSpecialist = () => {
    setSelectedSpecialist(null);
    setSearchQuery("");
    setShowDropdown(false);
  };

  const handleToggleExternalForm = () => {
    setShowExternalForm((prev) => !prev);
    // Clear any registered specialist selection when switching to external
    if (!showExternalForm) {
      setSelectedSpecialist(null);
      setSearchQuery("");
      setShowDropdown(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitError("");

    const scan = scans.find((s) => s.scan_id === selectedScanId);
    if (!scan) return;

    const usingExternal = showExternalForm && !selectedSpecialist;

    // Validation
    if (!usingExternal && !selectedSpecialist) {
      setSubmitError("Select a registered specialist or add an external doctor.");
      return;
    }
    if (usingExternal && (!extName.trim() || !extSpecialty.trim() || !extContact.trim())) {
      setSubmitError("Fill in all external specialist fields.");
      return;
    }
    if (!clinicalNotes.trim()) {
      setSubmitError("Clinical notes are required.");
      return;
    }

    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        patient_id: patientId,
        source_scan_id: selectedScanId,
        scan_type: scan.scan_type,
        prediction: scan.prediction ?? "unknown",
        confidence: 0,
        clinical_notes: clinicalNotes,
        priority,
      };

      if (usingExternal) {
        body.specialist_id = null;
        body.external_specialist = { name: extName, specialty: extSpecialty, contact: extContact };
      } else {
        body.specialist_id = selectedSpecialist!.specialist_id;
        body.external_specialist = null;
      }

      const res = await fetchWithAuth("/api/referrals/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail ?? "Failed to create referral");
      }

      const referral: ReferralRecord = await res.json();
      setExistingReferral(referral);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to submit referral");
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------

  const selectedScan = scans.find((s) => s.scan_id === selectedScanId);
  const statusInfo = existingReferral ? STATUS_CONFIG[existingReferral.status] : null;
  const showForm = !loadingReferral && !existingReferral && !!selectedScanId;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <Card className="mb-4 md:mb-6">
      {/* â”€â”€ Collapsible Header â”€â”€ */}
      <CardHeader
        className="p-4 md:p-6 cursor-pointer select-none"
        onClick={() => setIsOpen((o) => !o)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-8 w-8 md:h-9 md:w-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <SendHorizonal className="h-4 w-4 md:h-5 md:w-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-base md:text-lg">Referral</CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Refer this patient to a specialist
              </CardDescription>
            </div>
          </div>
          {isOpen
            ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
            : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
          }
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="p-4 md:p-6 pt-0 space-y-4 border-t border-gray-100">

          {/* â”€â”€ 1. Scan selector â”€â”€ */}
          {scans.length > 1 && (
            <div>
              <Label className="text-xs md:text-sm font-medium">Select Scan *</Label>
              <Select value={selectedScanId} onValueChange={setSelectedScanId}>
                <SelectTrigger className="mt-1 text-xs md:text-sm">
                  <SelectValue placeholder="Choose a scan to refer" />
                </SelectTrigger>
                <SelectContent>
                  {scans.map((s) => (
                    <SelectItem key={s.scan_id} value={s.scan_id}>
                      {SCAN_TYPE_LABEL[s.scan_type] ?? s.scan_type}
                      {" â€” "}
                      {new Date(s.upload_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {s.referral_triggered ? " Â· referred" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* â”€â”€ 2. Checking referral status â”€â”€ */}
          {loadingReferral && (
            <p className="text-xs text-gray-400">Checking referral statusâ€¦</p>
          )}

          {/* â”€â”€ 3. Status badge â€” existing referral for this scan â”€â”€ */}
          {!loadingReferral && existingReferral && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 md:p-4 space-y-2">
              <p className="text-xs md:text-sm font-semibold text-gray-700">Referral Status</p>
              {statusInfo && (
                <span
                  className={cn(
                    "inline-flex items-center text-xs font-semibold px-3 py-1.5 rounded-full border",
                    statusInfo.className
                  )}
                >
                  {statusInfo.label}
                </span>
              )}
              <div className="text-xs text-gray-500 space-y-1 pt-1">
                <p>
                  <span className="font-medium">Priority:</span>{" "}
                  <span className="capitalize">{existingReferral.priority}</span>
                </p>
                <p>
                  <span className="font-medium">Referred:</span>{" "}
                  {new Date(existingReferral.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
          )}

          {/* â”€â”€ 4. New referral form (only when scan has no existing referral) â”€â”€ */}
          {showForm && (
            <>
              {/* Specialist search */}
              <div className="relative">
                <Label className="text-xs md:text-sm font-medium">Search Specialist</Label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (selectedSpecialist) setSelectedSpecialist(null);
                    }}
                    placeholder="Search by name, specialty, hospital, email, or doctor ID"
                    className="pl-9 pr-8 text-xs md:text-sm"
                    disabled={!!selectedSpecialist}
                  />
                  {(selectedSpecialist || searchQuery) && (
                    <button
                      type="button"
                      onClick={handleClearSpecialist}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Search results dropdown */}
                {showDropdown && !selectedSpecialist && (
                  <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg divide-y divide-gray-100 max-h-48 overflow-y-auto">
                    {searchLoading ? (
                      <p className="text-xs text-gray-400 px-3 py-2">Searchingâ€¦</p>
                    ) : searchResults.length > 0 ? (
                      searchResults.map((s) => (
                        <button
                          key={s.specialist_id}
                          type="button"
                          onClick={() => handleSelectSpecialist(s)}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <UserAvatar
                              name={s.name}
                              role="doctor"
                              seed={s.specialist_id}
                              photoUrl={s.photo_url}
                              size="sm"
                            />
                            <div className="min-w-0">
                              <p className="text-xs md:text-sm font-semibold text-gray-800 truncate">{s.name}</p>
                              <p className="text-[10px] md:text-xs text-gray-500 mt-0.5 truncate">
                                {s.specialty} Â· {s.hospital_name}, {s.city}
                              </p>
                              <p className="text-[10px] md:text-xs text-gray-400 mt-0.5 truncate">
                                ID: {s.specialist_id} | {s.contact || "N/A"}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-gray-400 px-3 py-2">No registered specialists found.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Default Suggestions */}
              {!searchQuery && !selectedSpecialist && suggestions.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] md:text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    Suggested Specialists
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={`suggest-${s.specialist_id}`}
                        type="button"
                        onClick={() => handleSelectSpecialist(s)}
                        className="w-full text-left px-3 py-2.5 bg-indigo-50/50 hover:bg-indigo-100/50 rounded-lg border border-indigo-100/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            name={s.name}
                            role="doctor"
                            seed={s.specialist_id}
                            photoUrl={s.photo_url}
                            size="sm"
                          />
                          <div className="min-w-0">
                            <p className="text-xs md:text-sm font-semibold text-indigo-900 truncate">{s.name}</p>
                            <p className="text-[10px] md:text-xs text-indigo-600/80 mt-0.5 truncate">
                              {s.specialty} Â· {s.hospital_name}, {s.city}
                            </p>
                            <p className="text-[10px] md:text-xs text-indigo-700/70 mt-0.5 truncate">
                              ID: {s.specialist_id} | {s.contact || "N/A"}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selected specialist pill */}
              {selectedSpecialist && (
                <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2.5">
                  <p className="text-xs md:text-sm font-semibold text-indigo-800">
                    {selectedSpecialist.name}
                  </p>
                  <p className="text-[10px] md:text-xs text-indigo-600 mt-0.5">
                    {selectedSpecialist.specialty} Â· {selectedSpecialist.hospital_name},{" "}
                    {selectedSpecialist.city}
                  </p>
                  <p className="text-[10px] md:text-xs text-indigo-700/80 mt-0.5">
                    ID: {selectedSpecialist.specialist_id} | {selectedSpecialist.contact || "N/A"}
                  </p>
                </div>
              )}

              {/* â”€â”€ Always-visible "+ Add External Doctor" â”€â”€ */}
              <button
                type="button"
                onClick={handleToggleExternalForm}
                className="flex items-center gap-1.5 text-xs md:text-sm text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                {showExternalForm ? "Cancel external doctor" : "+ Add External Doctor"}
              </button>

              {/* External specialist form */}
              {showExternalForm && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 md:p-4 space-y-3">
                  <p className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    External Specialist
                  </p>
                  <div>
                    <Label className="text-xs font-medium">Full Name *</Label>
                    <Input
                      value={extName}
                      onChange={(e) => setExtName(e.target.value)}
                      placeholder="Dr. Full Name"
                      className="mt-1 text-xs md:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Specialty *</Label>
                    <Input
                      value={extSpecialty}
                      onChange={(e) => setExtSpecialty(e.target.value)}
                      placeholder="e.g. Cardiology"
                      className="mt-1 text-xs md:text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-medium">Contact (email or phone) *</Label>
                    <Input
                      value={extContact}
                      onChange={(e) => setExtContact(e.target.value)}
                      placeholder="doctor@hospital.com or +91-XXXXXXXXXX"
                      className="mt-1 text-xs md:text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Priority */}
              <div>
                <Label className="text-xs md:text-sm font-medium">Priority *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="mt-1 text-xs md:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="routine">Routine</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="emergency">Emergency</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Clinical notes */}
              <div>
                <Label className="text-xs md:text-sm font-medium">Clinical Notes *</Label>
                <Textarea
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  placeholder="Reason for referral, key findings, relevant historyâ€¦"
                  rows={3}
                  className="mt-1 text-xs md:text-sm"
                />
              </div>

              {/* Error message */}
              {submitError && (
                <p className="text-xs text-red-600">{submitError}</p>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full text-xs md:text-sm bg-indigo-600 hover:bg-indigo-700"
              >
                <SendHorizonal className="h-3.5 w-3.5 mr-2" />
                {submitting ? "Submittingâ€¦" : "Confirm Referral"}
              </Button>
            </>
          )}

          {/* Prompt when no scan is selected yet */}
          {!selectedScanId && scans.length > 1 && (
            <p className="text-xs text-gray-400 text-center py-2">
              Select a scan above to begin a referral.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

