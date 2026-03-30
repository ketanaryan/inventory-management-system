"use client";

import { useState } from "react";

interface BlockchainStatusProps {
  txHash?: string;
  blockchainRecord?: {
    batchNum: string;
    drugName: string;
    manufacturer: string;
    timestamp: number;
    status: string;
  } | null;
  loading?: boolean;
  error?: string;
}

export default function BlockchainStatus({
  txHash,
  blockchainRecord,
  loading,
  error,
}: BlockchainStatusProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="mt-4 p-4 bg-yellow-50 border border-yellow-300 rounded-xl flex items-center gap-3 animate-pulse">
        <div className="w-4 h-4 rounded-full bg-yellow-400 animate-spin" />
        <span className="text-yellow-700 font-medium text-sm">
          ⛓️ Writing to blockchain... please wait
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-600 text-sm font-medium">⚠️ Blockchain Error</p>
        <p className="text-red-500 text-xs mt-1">{error}</p>
        <p className="text-gray-400 text-xs mt-2">
          Make sure Ganache is running on port 7545 and contract is deployed.
        </p>
      </div>
    );
  }

  if (txHash) {
    return (
      <div className="mt-4 p-4 bg-emerald-50 border border-emerald-300 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 text-lg">✅</span>
            <span className="text-emerald-700 font-semibold text-sm">
              Recorded on Blockchain
            </span>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-emerald-600 underline"
          >
            {expanded ? "Hide" : "Details"}
          </button>
        </div>
        {expanded && (
          <div className="mt-3 space-y-1">
            <div className="flex gap-2 items-start">
              <span className="text-gray-500 text-xs w-24 shrink-0">TX Hash:</span>
              <span className="text-gray-700 text-xs font-mono break-all">{txHash}</span>
            </div>
            {blockchainRecord && (
              <>
                <div className="flex gap-2">
                  <span className="text-gray-500 text-xs w-24 shrink-0">Drug:</span>
                  <span className="text-gray-700 text-xs">{blockchainRecord.drugName}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 text-xs w-24 shrink-0">Batch #:</span>
                  <span className="text-gray-700 text-xs">{blockchainRecord.batchNum}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 text-xs w-24 shrink-0">Status:</span>
                  <span className={`text-xs font-semibold ${blockchainRecord.status === "Recalled" ? "text-red-600" : "text-green-600"}`}>
                    {blockchainRecord.status}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 text-xs w-24 shrink-0">Logged By:</span>
                  <span className="text-gray-700 text-xs font-mono break-all">{blockchainRecord.manufacturer}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-gray-500 text-xs w-24 shrink-0">Timestamp:</span>
                  <span className="text-gray-700 text-xs">
                    {new Date(blockchainRecord.timestamp * 1000).toLocaleString()}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return null;
}
