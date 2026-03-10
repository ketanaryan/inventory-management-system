"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { 
  Search, ShieldCheck, ShieldAlert, LogOut, 
  Navigation, Calendar, Package, Info, Bookmark, Trash2, Clock 
} from "lucide-react";

export default function ConsumerDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"verify" | "history">("verify");

  // States
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [verificationHistory, setVerificationHistory] = useState<any[]>([]);

  // ===== 1. AUTH & DATA FETCH =====
  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
        await fetchHistory(user.id);
        setLoading(false);
      }
    };
    init();
  }, [router]);

  // FIXED: Manual Join to prevent "Relationship not found" error
  const fetchHistory = async (userId: string) => {
    // 1. Fetch user's scans
    const { data: scans, error: scanError } = await supabase
      .from("user_scans")
      .select("*")
      .eq("user_id", userId)
      .order("scanned_at", { ascending: false });

    if (scanError) {
      console.error("Error fetching scans:", scanError.message);
      return;
    }

    if (!scans || scans.length === 0) {
      setVerificationHistory([]);
      return;
    }

    // 2. Extract batch IDs and fetch medicine details
    const batchIds = scans.map(s => s.batch_id);
    const { data: batchDetails, error: batchError } = await supabase
      .from("batches")
      .select("batch_id, status, medicines")
      .in("batch_id", batchIds);

    if (batchError) {
      console.error("Error fetching batch details:", batchError.message);
    }

    // 3. Manually merge the data
    const formatted = scans.map(scan => {
      const details = batchDetails?.find(b => b.batch_id === scan.batch_id);
      return {
        ...scan,
        batches: details // Attach the details manually
      };
    });

    setVerificationHistory(formatted);
  };

  // ===== 2. MAP SETUP (Original Behavior) =====
  useEffect(() => {
    if (loading) return;
    let map: any;
    const initMap = async () => {
      const L = (await import("leaflet")).default;
      const container = L.DomUtil.get("healthcare-map");
      if (container) (container as any)._leaflet_id = null;
      map = L.map("healthcare-map").setView([19.2183, 72.9781], 11);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20 }).addTo(map);
    };
    initMap();
    return () => { if (map) map.remove(); };
  }, [loading]);

  // ===== 3. HANDLERS (VERIFY & DELETE) =====
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!batchId.trim()) return;

    setResult(null);
    setMessage("Scanning Ledger...");
    setMessageType("");

    const { data: batchData, error: fetchError } = await supabase
      .from("batches")
      .select("*")
      .eq("batch_id", batchId)
      .single();

    if (fetchError || !batchData) {
      setMessage("Counterfeit Detected: Trace not found in ledger.");
      setMessageType("error");
      return;
    }

    // Save scan entry
    const { error: insertError } = await supabase
      .from("user_scans")
      .insert([{ user_id: user?.id, batch_id: batchId }]);

    if (!insertError) {
      await fetchHistory(user!.id);
      setMessageType(batchData.status === "Recalled" ? "error" : "success");
      setMessage(batchData.status === "Recalled" 
        ? "COMPROMISED BATCH - MEDICAL RECALL ACTIVE. DO NOT CONSUME." 
        : "Authentic Product - Origin verified via blockchain trace."
      );
    } else {
      console.error("Save failed:", insertError.message);
      setMessage("Verified, but save failed: " + insertError.message);
    }

    setResult(batchData);
  };

  const handleDeleteScan = async (scanId: string) => {
    const { error } = await supabase.from("user_scans").delete().eq("id", scanId);
    if (!error) {
      setVerificationHistory(prev => prev.filter(item => item.id !== scanId));
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans relative">
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none z-0" />

      {/* Navbar */}
      <nav className="border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 font-bold text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            PharmaVerify Public
          </div>
          <div className="flex items-center gap-6">
            <ThemeToggle />
            <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-400 flex items-center gap-2 font-medium">
              <LogOut size={16} /> Disconnect
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Left Column: Tools */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex gap-2 p-1 bg-card/50 border border-border rounded-2xl">
            <button onClick={() => setActiveTab("verify")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === "verify" ? "bg-primary text-white" : "text-muted-foreground"}`}>Verify Scan</button>
            <button onClick={() => setActiveTab("history")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === "history" ? "bg-primary text-white" : "text-muted-foreground"}`}>My Cabinet</button>
          </div>

          {activeTab === "verify" ? (
            <div className="glass-panel p-8 rounded-3xl border border-border shadow-2xl animate-fade-in">
              <h2 className="text-xl font-bold mb-8 text-center uppercase tracking-tighter italic">Product Handshake</h2>
              <form onSubmit={handleVerify} className="mb-8">
                <input
                  type="text"
                  placeholder="ENTER BATCH IDENTIFIER"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full px-5 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-foreground font-mono text-sm mb-4"
                />
                <button className="w-full bg-primary py-4 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-primary/20">Verify Ledger</button>
              </form>

              {message && (
                <div className={`p-4 rounded-xl text-xs font-bold mb-6 flex items-start gap-3 border ${messageType === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-600" : "bg-red-50 border-red-100 text-red-600"}`}>
                  {messageType === "success" ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                  <span className="leading-relaxed">{message}</span>
                </div>
              )}

              {result?.medicines?.map((med: any, i: number) => (
                <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4 text-slate-800 mt-4 animate-slide-up">
                  <div className="flex justify-between items-center">
                    <h3 className="text-2xl font-bold">{med.name}</h3>
                    <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-widest">Genuine</span>
                  </div>
                  <div className="flex gap-6 text-slate-500">
                    <div className="flex items-center gap-2 text-sm font-medium"><Calendar size={16} /> {med.expiryDate || med.expiry_date}</div>
                    <div className="flex items-center gap-2 text-sm font-medium"><Package size={16} /> Qty: {med.quantity}</div>
                  </div>
                  <div className="pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400 mb-2 font-bold uppercase text-[10px] tracking-widest">
                      <Info size={14} /> Patient Instructions
                    </div>
                    <p className="text-xs text-slate-500 italic leading-relaxed">Store in a cool, dry place. If dizziness or nausea occurs, contact a healthcare provider immediately.</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel p-8 rounded-3xl border border-border shadow-2xl h-[580px] overflow-y-auto">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 italic uppercase tracking-tighter"><Bookmark size={20}/> Secured Cabinet</h2>
              <div className="space-y-3">
                {verificationHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-20 text-xs italic font-medium">Your medicine history is currently empty.</p>
                ) : verificationHistory.map((item, i) => (
                  <div key={i} className="group p-4 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all relative">
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteScan(item.id); }} className="absolute top-4 right-4 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={16} />
                    </button>
                    <div className="mb-2 pr-8">
                      <p className="font-bold text-sm text-foreground uppercase truncate">
                        {item.batches?.medicines?.[0]?.name || `Batch ${item.batch_id}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {item.batch_id}</p>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded ${item.batches?.status === 'Recalled' ? 'bg-red-500 text-white' : 'bg-emerald-500/20 text-emerald-400'}`}>
                        {item.batches?.status || "ACTIVE"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{new Date(item.scanned_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Map */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Navigation className="w-6 h-6 text-primary" /> Facility Radar
            </h2>
          </div>
          <div className="glass-panel p-2 rounded-3xl border border-border shadow-2xl relative">
            <div id="healthcare-map" className="w-full h-[605px] rounded-2xl bg-[#09090b]" />
          </div>
        </div>
      </div>
    </div>
  );
}