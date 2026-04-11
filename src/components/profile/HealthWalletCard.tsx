import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/services/api";
import { cn } from "@/utils";

interface ChainBlock {
  block_id: string;
  record_id: string;
  verified: boolean;
}

interface ChainResponse {
  total_blocks: number;
  blocks: ChainBlock[];
}

interface VerifyResponse {
  verified: boolean;
}

const shortenAddress = (address?: string) => {
  if (!address) return "Not available";
  if (address.length <= 18) return address;
  return `${address.slice(0, 14)}...`;
};

export function HealthWalletCard({
  patientId,
  walletAddress,
}: {
  patientId: string;
  walletAddress?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [blocks, setBlocks] = useState<ChainBlock[]>([]);
  const [verificationDone, setVerificationDone] = useState(false);
  const [allVerified, setAllVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadChain = async () => {
      setLoading(true);
      setVerifyError(null);
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
        setVerifyError(err instanceof Error ? err.message : "Failed to load chain data");
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

  const uniqueRecordIds = useMemo(
    () => Array.from(new Set(blocks.map((block) => block.record_id))).filter(Boolean),
    [blocks]
  );

  const handleVerifyChain = async () => {
    if (!uniqueRecordIds.length) {
      setVerificationDone(true);
      setAllVerified(true);
      setVerifyError(null);
      return;
    }

    setVerifying(true);
    setVerifyError(null);

    try {
      const results = await Promise.all(
        uniqueRecordIds.map(async (recordId) => {
          const response = await fetchWithAuth(`/api/chain/verify/${recordId}`);
          if (!response.ok) {
            throw new Error(`Verification failed for ${recordId}`);
          }
          const payload: VerifyResponse = await response.json();
          return Boolean(payload.verified);
        })
      );

      const isAllGreen = results.every(Boolean);
      setVerificationDone(true);
      setAllVerified(isAllGreen);
      if (!isAllGreen) {
        setVerifyError("One or more records failed verification");
      }
    } catch (err) {
      setVerificationDone(true);
      setAllVerified(false);
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const secureState = verificationDone ? allVerified : Boolean(blocks.length);

  return (
    <div className="mb-6 rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/70 via-white to-blue-50/40 p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-xl bg-cyan-100 p-2">
            <Wallet className="h-5 w-5 text-cyan-700" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Your Health Wallet</h3>
            <p className="text-xs text-gray-500">Decentralized identity for your records</p>
          </div>
        </div>

        <span
          className={cn(
            "rounded-full border px-2 py-1 text-[10px] font-semibold",
            secureState
              ? "border-emerald-200 bg-emerald-100 text-emerald-700"
              : "border-amber-200 bg-amber-100 text-amber-700"
          )}
        >
          {secureState ? "Secure" : "Needs Verification"}
        </span>
      </div>

      <div className="space-y-2 rounded-xl border border-white/80 bg-white/90 p-3">
        <p className="text-xs text-gray-500">Address</p>
        <p className="font-mono text-sm font-medium text-gray-900">{shortenAddress(walletAddress)}</p>

        <div className="pt-2">
          <p className="text-xs text-gray-500">Records on chain</p>
          <p className="text-sm font-semibold text-gray-900">{loading ? "..." : blocks.length}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500">Status</p>
          <p className="text-sm font-semibold text-gray-900">
            {verificationDone ? (allVerified ? "Verified and secure" : "Verification mismatch") : "Secure"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={handleVerifyChain} disabled={verifying || loading} className="gap-2">
          <ShieldCheck className="h-4 w-4" />
          {verifying ? "Verifying..." : "Verify Chain"}
        </Button>
        {verificationDone && allVerified && <p className="text-sm font-medium text-emerald-700">All records verified</p>}
      </div>

      {verifyError && <p className="mt-2 text-sm text-red-600">{verifyError}</p>}
    </div>
  );
}
