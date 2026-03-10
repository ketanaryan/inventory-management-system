"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { ShieldCheck, ShieldAlert, Calendar, Package, Info } from "lucide-react";

export default function VerifyBatchPage() {
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Automatically parse batchId from URL (e.g., /verify/123)
  useEffect(() => {
    const urlParams = window.location.pathname.split('/');
    const id = urlParams[urlParams.length - 1];
    if (id && id !== "[batchID]" && id !== "verify") {
      setBatchId(decodeURIComponent(id));
      // Optionally auto-trigger verification if ID is in URL
      // triggerAutoVerify(decodeURIComponent(id));
    }
  }, []);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!batchId) return;

    setLoading(true);
    setMessage("");
    setResult(null);

    try {
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("batch_id", batchId)
        .single();

      if (error || !data) {
        setMessage("Counterfeit Warning: This Batch ID does not exist in the official records.");
        setLoading(false);
        return;
      }

      setResult(data);
    } catch (err) {
      setMessage("Error connecting to the verification server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col items-center p-4 md:p-8 text-slate-900 font-sans">
      
      {/* Header Area */}
      <div className="w-full max-w-md text-center mb-8">
        <h1 className="text-3xl font-black text-blue-600 mb-2">PharmaDash</h1>
        <p className="text-slate-500 font-medium">Official Medicine Authentication Portal</p>
      </div>

      {/* Input Section */}
      <div className="w-full max-w-md bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-6">
        <form onSubmit={handleVerify} className="space-y-4">
          <label className="text-sm font-bold text-slate-400 uppercase tracking-widest px-1">
            Enter Batch Number
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="e.g. BTC-9920"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-mono focus:border-blue-500 outline-none transition-all"
            />
          </div>
          <button 
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 active:scale-95 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2"
          >
            {loading ? "Verifying..." : "Verify Safety Now"}
          </button>
        </form>
      </div>

      {/* Result Messaging */}
      {message && (
        <div className="w-full max-w-md p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-start gap-3 mb-6">
          <ShieldAlert className="text-red-500 shrink-0" />
          <p className="text-red-700 font-bold text-sm leading-tight">{message}</p>
        </div>
      )}

      {/* DETAILED RESULTS CARD */}
      {result && (
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Main Status Header */}
          <div className={`p-6 rounded-t-3xl text-white flex flex-col items-center text-center ${result.status === 'Recalled' ? 'bg-red-500' : 'bg-emerald-500'}`}>
            {result.status === 'Recalled' ? <ShieldAlert size={48} /> : <ShieldCheck size={48} />}
            <h2 className="text-2xl font-black mt-2">
              {result.status === 'Recalled' ? "DO NOT CONSUME" : "VERIFIED AUTHENTIC"}
            </h2>
            <p className="opacity-90 text-sm font-medium">
              Batch Registry ID: {result.batch_id}
            </p>
          </div>

          {/* Medicine List Section */}
          <div className="bg-white rounded-b-3xl border-x border-b border-slate-200 p-6 space-y-6">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <Package size={18} />
              <span className="text-xs font-bold uppercase tracking-widest">Medicines in this Batch</span>
            </div>

            {/* Loop through the JSONB medicines array */}
            {Array.isArray(result.medicines) && result.medicines.map((med: any, idx: number) => {
              const isExpired = new Date(med.expiryDate || med.expiry_date) < new Date();
              
              return (
                <div key={idx} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 relative overflow-hidden">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-bold text-slate-800 capitalize">{med.name}</h3>
                    <span className="text-[10px] bg-white border border-slate-200 px-2 py-1 rounded-lg font-bold text-slate-400">
                      QTY: {med.quantity}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar size={16} className={isExpired ? "text-red-500" : "text-blue-500"} />
                    <span className="font-medium text-slate-600">Expiry:</span>
                    <span className={`font-bold ${isExpired ? "text-red-600" : "text-slate-900"}`}>
                      {med.expiryDate || med.expiry_date}
                    </span>
                  </div>

                  {isExpired && (
                    <div className="mt-2 text-[10px] font-black text-red-500 uppercase flex items-center gap-1">
                      <Info size={12} /> This medicine is past its expiry date
                    </div>
                  )}
                </div>
              );
            })}

            {/* Safety Advice */}
            <div className="pt-4 border-t border-slate-100">
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Verification data is provided by the manufacturer. If the physical packaging looks tampered with despite a successful scan, please consult your pharmacist.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}