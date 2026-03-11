"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { 
  LayoutDashboard, CheckCircle, Package, 
  AlertTriangle, Bell, Search, LogOut, Activity, FlaskConical, Clock, ShieldAlert
} from "lucide-react";
import { getMedicineAlternatives } from "@/app/actions/getMedicineAlternatives";

export default function HospitalDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [batches, setBatches] = useState<any[]>([]);
  const [batchIdInput, setBatchIdInput] = useState("");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState("");

  // 1. Authentication & Initial Data Fetch
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
        fetchBatches();
      }
    };
    checkUser();
  }, [router]);

  // 2. Fetch Live Entries from your Supabase 'batches' table
  const fetchBatches = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBatches(data);
    }
    setLoading(false);
  };

  // 3. Logic to process JSONB 'medicines' and filter by Expiry/Recall
  const processedData = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const inventory: any[] = [];
    const expiringSoon: any[] = [];
    const recalled: any[] = [];

    batches.forEach(batch => {
      // Access the JSONB array in your table
      const medList = Array.isArray(batch.medicines) ? batch.medicines : [];
      
      medList.forEach((med: any) => {
        const item = {
          batch_id: batch.batch_id,
          status: batch.status,
          name: med.name || "Unknown Medicine",
          quantity: med.quantity || "0",
          // Support both camelCase and snake_case from your JSON
          expiryDate: med.expiryDate || med.expiry_date || med.expiry, 
          created_at: batch.created_at
        };

        inventory.push(item);

        if (batch.status === "Recalled") {
          recalled.push(item);
        } else if (item.expiryDate) {
          const exp = new Date(item.expiryDate);
          if (exp > today && exp <= thirtyDaysFromNow) {
            expiringSoon.push(item);
          }
        }
      });
    });

    return { inventory, expiringSoon, recalled };
  }, [batches]);

  // 4. Feature Handlers
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifyMessage("Searching ledger...");
    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .eq("batch_id", batchIdInput)
      .single();
    
    if (error || !data) {
      setVerifyMessage("❌ Counterfeit Alert: Batch ID not found.");
      setVerificationResult(null);
    } else {
      setVerificationResult(data);
      setVerifyMessage(data.status === "Recalled" ? "⚠️ RECALLED: System reject." : "✅ Authentic: Hash Verified.");
    }
  };

  const handleSearchAlternatives = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!searchQuery.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const result = await getMedicineAlternatives(searchQuery);
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to find alternatives");
    } finally {
      setAiLoading(false);
    }
  };

  if (loading && batches.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Activity className="w-10 h-10 text-primary animate-spin" />
          <div className="text-xl font-medium tracking-tight">
            Connecting to PharmaChain Secure Node...
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "Dashboard", icon: <LayoutDashboard size={20}/>, label: "Overview" },
    { id: "Batch Verification", icon: <CheckCircle size={20}/>, label: "Verify Batch" },
    { id: "Medicine Inventory", icon: <Package size={20}/>, label: "Inventory Data" },
    { id: "Expiry Alerts", icon: <Bell size={20}/>, label: "Expiry Matrix", count: processedData.expiringSoon.length },
    { id: "Recall Alerts", icon: <AlertTriangle size={20}/>, label: "Recall Alerts", count: processedData.recalled.length },
    { id: "Alternatives", icon: <Search size={20}/>, label: "AI Alternatives" },
  ];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-background text-foreground font-sans overflow-hidden selection:bg-primary/30">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {/* SIDEBAR */}
      <aside className="w-full lg:w-72 glass border-b lg:border-b-0 lg:border-r border-border flex flex-col relative z-20 shrink-0">
        <div className="p-4 lg:p-8 border-b border-border flex items-center justify-between lg:justify-start">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-primary rounded-xl flex items-center justify-center text-foreground font-bold mr-4 shadow-lg shadow-blue-500/20">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none text-foreground">PharmaDash</h1>
              <span className="text-xs text-blue-400 font-medium uppercase tracking-wider mt-1 lg:block hidden">Hospital Node</span>
            </div>
          </div>
        </div>

        <nav className="flex-none lg:flex-1 px-4 py-4 lg:py-8 flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto no-scrollbar">
          {tabs.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex-none lg:w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 relative group overflow-hidden whitespace-nowrap ${
                  isActive ? "text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {isActive && <div className="absolute inset-0 bg-primary opacity-100" />}
                {!isActive && <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />}
                
                <div className="flex items-center gap-4 relative z-10 transition-colors"> 
                  <span className={`${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-primary"}`}>{item.icon}</span> 
                  <span className="tracking-wide text-sm font-medium">{item.label}</span> 
                </div>
                {item.count ? (
                  <span className={`relative z-10 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm ${
                    isActive ? "bg-white text-primary" : "bg-red-500/20 text-red-400 border border-red-500/30"
                  }`}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="hidden lg:block p-6 border-t border-border bg-card">
          <button onClick={handleLogout} className="flex items-center gap-3 text-muted-foreground hover:text-red-400 w-full transition-colors font-medium text-sm">
            <LogOut size={18}/> Terminate Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative z-10 w-full overflow-hidden">
        <header className="px-6 lg:px-10 py-4 lg:py-6 border-b border-border flex justify-between items-center backdrop-blur-md bg-background/50 sticky top-0 shrink-0 z-10">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <h2 className="text-sm tracking-wider uppercase font-bold text-foreground opacity-90">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="text-sm text-muted-foreground bg-card border border-border px-4 py-2 rounded-full font-medium">
              Terminal User: <span className="text-foreground ml-1">{user?.email}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar w-full">
          
          {/* 1. OVERVIEW */}
          {activeTab === "Dashboard" && (
            <div className="space-y-8 animate-fade-in relative z-10 pb-16 w-full">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8">Facility Overview</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Total Network Stock" value={processedData.inventory.length} icon={<Package className="text-blue-500 w-8 h-8"/>} textColor="text-blue-400" bgColor="bg-blue-500/10" borderColor="border-blue-500/20" />
                <StatCard title="Critical Threshold (<30d)" value={processedData.expiringSoon.length} icon={<Clock className="text-amber-500 w-8 h-8"/>} textColor="text-amber-400" bgColor="bg-amber-500/10" borderColor="border-amber-500/20" />
                <StatCard title="Compromised Nodes" value={processedData.recalled.length} icon={<AlertTriangle className="text-red-500 w-8 h-8"/>} textColor="text-red-400" bgColor="bg-red-500/10" borderColor="border-red-500/20" />
              </div>

              {/* Predictive Restock Simulator */}
              <div className="glass-panel rounded-2xl border border-primary/20 bg-primary/5 shadow-2xl overflow-hidden mt-8 relative group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
                <div className="p-6 border-b border-primary/10 flex justify-between items-center relative z-10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 text-primary shadow-lg shadow-primary/20">
                       <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground tracking-wide uppercase">AI Restock Nexus</h3>
                      <p className="text-[10px] text-primary font-bold tracking-widest uppercase mt-0.5">Predictive Consumption Models</p>
                    </div>
                  </div>
                  <span className="bg-primary/20 text-primary px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-primary/30 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                    Active Simulation
                  </span>
                </div>
                
                <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
                  <div className="p-5 rounded-2xl bg-card border border-border animate-slide-up shadow-inner">
                     <p className="text-foreground font-semibold mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500" /> Paracetamol IV</p>
                     <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Consumption spike detected</p>
                     <div className="w-full bg-white/5 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div className="bg-amber-500 h-1.5 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: '85%' }}></div>
                     </div>
                     <p className="text-[10px] text-amber-500 font-bold uppercase text-right tracking-widest">Est. Depletion: 48 Hrs</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-card border border-border animate-slide-up shadow-inner" style={{ animationDelay: '100ms' }}>
                     <p className="text-foreground font-semibold mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> Amoxicillin 500mg</p>
                     <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Critical shortage zone</p>
                     <div className="w-full bg-white/5 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div className="bg-red-500 h-1.5 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ width: '95%' }}></div>
                     </div>
                     <p className="text-[10px] text-red-500 font-bold uppercase text-right tracking-widest">Est. Depletion: 12 Hrs</p>
                  </div>
                  <div className="p-5 rounded-2xl bg-card border border-border animate-slide-up shadow-inner" style={{ animationDelay: '200ms' }}>
                     <p className="text-foreground font-semibold mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-primary" /> Saline Solution</p>
                     <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">Deviation from baseline</p>
                     <div className="w-full bg-white/5 rounded-full h-1.5 mb-2 overflow-hidden">
                        <div className="bg-primary h-1.5 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]" style={{ width: '60%' }}></div>
                     </div>
                     <p className="text-[10px] text-primary font-bold uppercase text-right tracking-widest">Est. Depletion: 5 Days</p>
                  </div>
                </div>
              </div>

              <div className="glass-panel rounded-2xl border border-border shadow-2xl overflow-hidden mt-8">
                <div className="p-6 border-b border-border bg-white/5 flex justify-between items-center">
                  <h3 className="font-semibold text-foreground tracking-wide uppercase text-sm">Live Inventory Stream</h3>
                  <button onClick={fetchBatches} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Sync Ledger
                  </button>
                </div>
                <InventoryTable data={processedData.inventory.slice(0, 10)} />
              </div>
            </div>
          )}

          {/* 2. VERIFICATION */}
          {activeTab === "Batch Verification" && (
             <div className="max-w-2xl mx-auto animate-fade-in relative z-10">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 text-center">Protocol Verification</h2>
              <div className="glass-panel p-10 rounded-3xl border border-border shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                <p className="text-muted-foreground mb-8">Query the distributed ledger to authenticate spatial payload identifiers.</p>
                <form onSubmit={handleVerify} className="space-y-6 relative z-10">
                  <input
                    type="text"
                    placeholder="ENTER HASH (E.G. BATCH-2026-X)"
                    value={batchIdInput}
                    onChange={(e) => setBatchIdInput(e.target.value)}
                    className="w-full p-4 bg-card border border-border rounded-xl text-center text-lg font-mono outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground transition-all uppercase tracking-widest"
                  />
                  <button className="w-full bg-primary hover:bg-primary/90 text-foreground py-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide font-medium">
                    Run Authenticity Check
                  </button>
                </form>

                {verifyMessage && (
                  <div className={`mt-8 p-4 rounded-xl text-sm font-medium animate-slide-up flex flex-col items-center justify-center border ${
                    verifyMessage.includes('✅') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {verifyMessage}
                  </div>
                )}

                {verificationResult && (
                  <div className="mt-10 pt-8 border-t border-border flex flex-col items-center animate-scale-in">
                    <div className="p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.2)]">
                      <QRCodeCanvas value={`${window.location.origin}/verify/${verificationResult.batch_id}`} size={160} fgColor="#09090b" />
                    </div>
                    <p className="mt-6 font-mono text-sm tracking-wider text-muted-foreground">ID: <span className="text-foreground">{verificationResult.batch_id}</span></p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. INVENTORY */}
          {activeTab === "Medicine Inventory" && (
            <div className="glass-panel rounded-2xl border border-border shadow-2xl overflow-hidden animate-fade-in relative z-10">
              <div className="p-6 border-b border-border bg-white/5">
                <h3 className="font-semibold text-foreground tracking-wide uppercase text-sm">Complete Vault Inventory</h3>
              </div>
              <InventoryTable data={processedData.inventory} />
            </div>
          )}

          {/* 4. EXPIRY ALERTS */}
          {activeTab === "Expiry Alerts" && (
            <div className="max-w-5xl mx-auto animate-fade-in relative z-10">
               <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 flex items-center gap-3">
                 <Clock className="w-8 h-8 text-amber-500" /> Temporal Decay Vectors
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {processedData.expiringSoon.length === 0 ? (
                  <div className="glass-panel border border-border p-16 text-center rounded-2xl text-emerald-500/70 text-sm tracking-wider uppercase">
                     <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" /> System Nominal. No critical items detected.
                  </div>
                ) : 
                  processedData.expiringSoon.map((item, i) => <AlertCard key={i} item={item} type="expiry" />)
                }
              </div>
            </div>
          )}

          {/* 5. RECALL ALERTS */}
          {activeTab === "Recall Alerts" && (
            <div className="max-w-5xl mx-auto animate-fade-in relative z-10">
               <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 flex items-center gap-3">
                 <ShieldAlert className="w-8 h-8 text-red-500" /> Compromised Vectors
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {processedData.recalled.length === 0 ? (
                  <div className="glass-panel border border-border p-16 text-center rounded-2xl text-emerald-500/70 text-sm tracking-wider uppercase">
                     <CheckCircle className="w-8 h-8 mx-auto mb-3 opacity-50" /> Vault secure. No compromised instances.
                  </div>
                ) : 
                  processedData.recalled.map((item, i) => <AlertCard key={i} item={item} type="recall" />)
                }
              </div>
            </div>
          )}

          {/* 6. ALTERNATIVES */}
          {activeTab === "Alternatives" && (
            <div className="max-w-3xl mx-auto space-y-8 animate-fade-in relative z-10">
               <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">Smart Substitute Index</h2>
               <p className="text-muted-foreground mb-8">AI-driven mapping for chemically similar compounds when primary stock is unavailable.</p>
              
              <form onSubmit={handleSearchAlternatives} className="flex gap-3">
                <input
                  type="text"
                  placeholder="Query required molecular compound (e.g. Paracetamol)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 p-4 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all shadow-inner"
                />
                <button disabled={aiLoading} className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-foreground px-8 rounded-xl font-medium shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] flex items-center gap-2">
                   {aiLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> : <Search size={16} />} 
                   {aiLoading ? "Querying..." : "Query"}
                </button>
              </form>
              
              {aiError && (
                <div className="p-4 rounded-xl text-xs font-bold mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-500">
                  <AlertTriangle size={18} />
                  <span className="leading-relaxed">{aiError}</span>
                </div>
              )}
              
              {aiResult && (
                <div className="space-y-6 flex-1 overflow-y-auto pr-2 pb-4 animate-slide-up">
                  <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl rounded-tr-none"></div>
                    <div className="relative z-10">
                      <h3 className="text-2xl font-black text-foreground mb-1">{aiResult.name}</h3>
                      <p className="text-primary font-bold text-sm mb-4">Generic: {aiResult.genericName}</p>
                      
                      <div className="space-y-4">
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">Purpose</h4>
                          <p className="text-sm text-foreground/80 leading-relaxed bg-background/50 p-4 rounded-xl border border-border/50">{aiResult.purpose}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {aiResult.alternatives && aiResult.alternatives.length > 0 && (
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest text-foreground mb-4 flex items-center gap-2">
                        <Package size={16} className="text-primary" /> Available Alternatives
                      </h4>
                      <div className="grid gap-4">
                        {aiResult.alternatives.map((alt: any, i: number) => {
                          // Check if we have this alternative in stock
                          const inStockMatch = processedData.inventory.find((med: any) => med.name.toLowerCase().includes(alt.name.toLowerCase()));
                          const stockCount = inStockMatch ? inStockMatch.quantity : 0;
                          
                          return (
                            <div key={i} className="glass-panel p-6 rounded-2xl border border-border flex justify-between items-center shadow-lg hover:border-primary/20 transition-all group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-primary border border-border group-hover:bg-primary/10 transition-colors">
                                  <FlaskConical className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{alt.name}</h4>
                                  <p className="text-xs text-muted-foreground tracking-wider uppercase mt-1">Mfr: {alt.manufacturer}</p>
                                </div>
                              </div>
                              {stockCount > 0 ? (
                                <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded-full font-bold text-xs tracking-wider uppercase">Vault Stock: {stockCount}</span>
                              ) : (
                                <span className="bg-red-500/10 text-red-500/70 border border-red-500/20 px-4 py-1.5 rounded-full font-bold text-xs tracking-wider uppercase">Not in Vault</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function StatCard({ title, value, icon, textColor, bgColor, borderColor }: any) {
  return (
    <div className={`glass-panel p-6 rounded-2xl border flex items-center gap-5 relative overflow-hidden group ${borderColor}`}>
      <div className={`w-14 h-14 rounded-full flex items-center justify-center ${bgColor}`}>
         {icon}
      </div>
      <div>
        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1">{title}</p>
        <h4 className={`text-4xl font-black ${textColor}`}>{value}</h4>
      </div>
    </div>
  );
}

function InventoryTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left whitespace-nowrap">
        <thead>
          <tr className="bg-card text-muted-foreground text-[10px] uppercase font-bold tracking-widest border-b border-border">
            <th className="px-8 py-5">Substance String</th>
            <th className="px-8 py-5">Hash ID</th>
            <th className="px-8 py-5">Volume</th>
            <th className="px-8 py-5">Decay Threshold</th>
            <th className="px-8 py-5">Integrity</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {data.length > 0 ? data.map((item, i) => (
            <tr key={i} className="hover:bg-muted transition-colors group">
              <td className="px-8 py-5 font-bold text-foreground capitalize flex items-center gap-3">
                 <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-border group-hover:border-primary/30 transition-colors">
                    <FlaskConical className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                 </div>
                 {item.name}
              </td>
              <td className="px-8 py-5 font-mono text-xs text-primary">{item.batch_id}</td>
              <td className="px-8 py-5 text-muted-foreground font-medium">{item.quantity} units</td>
              <td className="px-8 py-5 text-sm text-muted-foreground">
                {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "N/A"}
              </td>
              <td className="px-8 py-5">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  item.status === 'Recalled' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {item.status}
                </span>
              </td>
            </tr>
          )) : (
            <tr><td colSpan={5} className="py-12 text-center text-muted-foreground text-sm uppercase tracking-wider">No active ledger details.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AlertCard({ item, type }: { item: any, type: 'expiry' | 'recall' }) {
  const isRecall = type === 'recall';
  return (
    <div className={`p-6 rounded-2xl flex justify-between items-center shadow-lg border relative overflow-hidden ${
      isRecall ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
    }`}>
       <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] pointer-events-none rounded-full ${
          isRecall ? 'bg-red-500/10' : 'bg-amber-500/10'
       }`} />
      
      <div className="flex gap-5 items-center relative z-10">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${
           isRecall ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
        }`}>
           {isRecall ? <AlertTriangle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
        </div>
        <div>
          <h4 className="font-bold text-foreground text-lg capitalize">{item.name}</h4>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Hash Ref: <span className="text-primary font-mono">{item.batch_id}</span></p>
        </div>
      </div>
      <div className="text-right relative z-10">
        <p className={`font-black text-xl tracking-wide uppercase ${isRecall ? 'text-red-400' : 'text-amber-500'}`}>
          {isRecall ? 'COMPROMISED' : 'DECAYING'}
        </p>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">Event: {new Date(item.expiryDate).toLocaleDateString()}</p>
      </div>
    </div>
  );
}