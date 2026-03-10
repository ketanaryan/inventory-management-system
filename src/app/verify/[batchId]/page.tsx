"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/utils/supabase";
import ThemeToggle from "@/components/ThemeToggle";
import { ShieldCheck, ShieldAlert, Search, Activity } from "lucide-react";

export default function VerifyBatchPage() {
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [loading, setLoading] = useState(false);

  const params = useParams();
  
  // Automatically take batchId from URL if present
  useEffect(() => {
    const batchIdParam = params?.batchId as string;
    if (batchIdParam && batchIdParam !== "%5BbatchID%5D" && batchIdParam !== "verify") {
      const decoded = decodeURIComponent(batchIdParam);
      setBatchId(decoded);
      handleAutoVerify(decoded);
    }
  }, [params?.batchId]);

  const handleAutoVerify = async (id: string) => {
    if (!id) return;
    setLoading(true);
    await performVerify(id);
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await performVerify(batchId);
    setLoading(false);
  };

  const performVerify = async (idToVerify: string) => {
    setMessage("");
    setMessageType("");
    setResult(null);

    if (!idToVerify.trim()) {
      setMessage("Please enter a valid batch identifier.");
      setMessageType("error");
      return;
    }

    setMessage("Scanning distributed ledger...");
    setMessageType("");

    try {
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("batch_id", idToVerify)
        .single();

      if (error || !data) {
        setMessage("Counterfeit Detected: Trace not found in ledger.");
        setMessageType("error");
        return;
      }

      setResult(data);

      if (data.status === "Recalled") {
        setMessage("AUDIT ALERT: This batch has been SUSPENDED for inspection. Please await clearance.");
        setMessageType("error");
      } else {
        setMessage("Authentic Product - Origin verified via blockchain trace.");
        setMessageType("success");
      }
    } catch (err) {
      setMessage("Error verifying batch.");
      setMessageType("error");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative">
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none z-0" />

      {/* Navigation */}
      <nav className="border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
              <ShieldCheck className="w-4 h-4 text-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">PharmaVerify Public</span>
          </div>
          <div className="flex items-center gap-6">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12 relative z-10">
        <div className="glass-panel p-8 rounded-3xl border border-border shadow-2xl relative overflow-hidden animate-fade-in text-center">
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />

          <h2 className="text-2xl font-bold tracking-tight mb-2 relative z-10 text-foreground">Authenticate Product</h2>
          <p className="text-sm text-muted-foreground mb-8 relative z-10">Enter the cryptographic hash or batch number found on the physical packaging to verify its origin.</p>

          <form onSubmit={handleVerify} className="relative z-10 w-full mb-8">
            <div className="relative mb-4">
              <input
                type="text"
                placeholder="e.g. BATCH-2026-NEXUS"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground uppercase tracking-widest font-mono text-sm shadow-inner"
              />
              <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            <button
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-foreground font-medium py-3.5 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide relative overflow-hidden group flex justify-center items-center gap-2"
            >
              {loading ? (
                <>
                  <Activity className="w-5 h-5 animate-spin" />
                  <span className="relative z-10">Scanning Ledger...</span>
                </>
              ) : (
                <>
                  <span className="relative z-10">Execute Ledger Scan</span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </>
              )}
            </button>
          </form>

          {message && (
            <div className={`p-4 rounded-xl text-sm font-medium my-6 flex items-start gap-3 border animate-slide-up ${
              messageType === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-left" :
              messageType === "error" ? "bg-red-500/10 text-red-400 border-red-500/20 text-left" : "bg-white/5 text-muted-foreground text-center animate-pulse"
            }`}>
              {messageType === "success" && <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />}
              {messageType === "error" && <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />}
              <span className="leading-relaxed">{message}</span>
            </div>
          )}

          {result && (
            <div className="mt-8 text-left border-t border-border pt-8 animate-scale-in relative z-10">
              <h3 className="text-lg font-bold text-foreground mb-4">Batch Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-white/5 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Batch ID</p>
                  <p className="font-mono text-primary text-sm break-all">{result.batch_id}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Status</p>
                  <p className={`font-bold text-sm uppercase tracking-wide ${
                    result.status === "Recalled" ? "text-amber-500" : "text-emerald-400"
                  }`}>
                    {result.status === "Recalled" ? "Suspended (Audit)" : (result.status || "Active")}
                  </p>
                </div>
              </div>

              <h3 className="text-md font-bold text-foreground mb-3">Contents</h3>
              <div className="space-y-3">
                {Array.isArray(result.medicines) && result.medicines.length > 0 ? (
                  result.medicines.map((med: any, i: number) => (
                    <div key={i} className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-foreground text-base">{med.name || "Unknown Substance"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Volume: {med.quantity || "N/A"}</p>
                      </div>
                      <div className="sm:text-right">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Expiry Date</p>
                        <p className="text-sm font-medium text-amber-500">
                          {med.expiryDate || med.expiry_date || med.expiry 
                            ? new Date(med.expiryDate || med.expiry_date || med.expiry).toISOString().split('T')[0]
                            : "N/A"}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-card p-4 rounded-xl border border-border text-muted-foreground text-sm text-center">
                    No individual substance data tracked for this hash.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}