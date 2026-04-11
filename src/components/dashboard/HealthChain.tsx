import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, CornerDownRight, Link2 } from "lucide-react";

import { fetchWithAuth } from "@/services/api";
import { cn } from "@/utils";

interface ChainBlock {
  block_id: string;
  patient_id: string;
  record_type: "registration" | "scan" | "report" | "referral";
  record_id: string;
  record_hash: string;
  previous_hash: string;
  block_hash: string;
  timestamp: string;
  verified: boolean;
}

interface ChainResponse {
  patient_id: string;
  total_blocks: number;
  blocks: ChainBlock[];
}

const TYPE_LABELS: Record<ChainBlock["record_type"], string> = {
  registration: "Account Created",
  scan: "Scan Uploaded",
  report: "Report Generated",
  referral: "Referral Created",
};

const truncateHash = (value: string) => {
  if (!value) return "-";
  return `${value.slice(0, 8)}...`;
};

const parseChainTimestamp = (raw: string) => {
  if (!raw) return new Date(NaN);

  const value = raw.trim();
  if (/^\d+$/.test(value)) {
    const numeric = Number(value);
    const ms = numeric < 1_000_000_000_000 ? numeric * 1000 : numeric;
    return new Date(ms);
  }

  if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
    return new Date(value);
  }

  return new Date(`${value}Z`);
};

const formatDate = (raw: string) => {
  const date = parseChainTimestamp(raw);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function HealthChain({ patientId }: { patientId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ChainBlock[]>([]);

  useEffect(() => {
    let active = true;

    const loadChain = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetchWithAuth(`/api/chain/patient/${patientId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch chain (${response.status})`);
        }

        const payload: ChainResponse = await response.json();
        if (!active) return;
        setBlocks(Array.isArray(payload.blocks) ? payload.blocks : []);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load chain");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (patientId) {
      void loadChain();
    }

    return () => {
      active = false;
    };
  }, [patientId]);

  const totalBlocks = useMemo(() => blocks.length, [blocks]);

  if (loading) {
    return (
      <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Loading health chain...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8 rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (!blocks.length) {
    return (
      <div className="mb-8 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">My Health Chain</h3>
        <p className="mt-2 text-sm text-gray-500">No blocks yet. Your records will appear here automatically.</p>
      </div>
    );
  }

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40 shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/40"
      >
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl bg-emerald-100 p-2">
            <Link2 className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">My Health Chain</h3>
            <p className="text-xs text-gray-500">{totalBlocks} immutable blocks</p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="h-5 w-5 text-gray-500" /> : <ChevronDown className="h-5 w-5 text-gray-500" />}
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-emerald-100/80 px-5 py-4">
          {blocks.map((block, index) => {
            const blockNumber = totalBlocks - index;
            const isGenesis = block.previous_hash === "0000000000000000";
            const showPreviousLink = !isGenesis && !!block.previous_hash;
            const recordLabel = TYPE_LABELS[block.record_type] || block.record_type;

            return (
              <div key={block.block_id}>
                <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-gray-900">Block #{blockNumber}</p>
                    <span className="text-xs text-gray-500">{formatDate(block.timestamp)}</span>
                  </div>

                  <p className="mt-1 text-sm text-gray-700">{recordLabel}</p>
                  <p className="mt-2 font-mono text-xs text-gray-600">Hash: {truncateHash(block.record_hash)}</p>

                  <div className="mt-3 flex items-center gap-2">
                    {isGenesis ? (
                      <span className="rounded-full border border-violet-200 bg-violet-100 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                        Genesis Block
                      </span>
                    ) : (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
                          block.verified
                            ? "border-emerald-200 bg-emerald-100 text-emerald-700"
                            : "border-amber-200 bg-amber-100 text-amber-700"
                        )}
                      >
                        {block.verified ? "Verified" : "Pending Verification"}
                      </span>
                    )}
                  </div>
                </div>

                {showPreviousLink && (
                  <div className="ml-4 mt-2 flex items-start gap-2 text-[11px] text-gray-500">
                    <div className="flex flex-col items-center pt-0.5">
                      <span className="h-4 w-px bg-gray-300" />
                      <CornerDownRight className="h-3 w-3 text-gray-400" />
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-md bg-gray-50 px-2 py-1">
                      <Link2 className="h-3 w-3 text-gray-400" />
                      <span className="font-mono">links to previous: {truncateHash(block.previous_hash)}</span>
                    </div>
                  </div>
                )}
                </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
