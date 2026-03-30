"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import {
  LayoutDashboard, CheckCircle, Package,
  AlertTriangle, Bell, Search, LogOut, Activity, FlaskConical, Clock, ShieldAlert, Download, Menu, X,
  Sparkles, Zap, RefreshCw, Link, ShieldCheck, TrendingUp,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts";
import { saveScanOffline, getPendingScans, clearPendingScans } from "@/lib/offlineSync";
import { getBatchFromBlockchain, logBatchToBlockchain } from "@/lib/blockchain/inventoryChain";

export default function HospitalDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [batches, setBatches] = useState<any[]>([]);
  const [batchIdInput, setBatchIdInput] = useState("");
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [verifyMessage, setVerifyMessage] = useState("");
  const [verifyType, setVerifyType] = useState<"success" | "error" | "">("");
  const [searchQuery, setSearchQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiError, setAiError] = useState("");

  // Blockchain state
  const [isBlockchainSigning, setIsBlockchainSigning] = useState(false);
  const [blockchainMsg, setBlockchainMsg] = useState("");

  // AI Insights State
  const [insights, setInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // 1. Authentication & Initial Data Fetch
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
        fetchBatches(user.id);
      }
    };
    checkUser();
  }, [router]);

  // Offline Sync Listener
  useEffect(() => {
    const handleOnline = async () => {
      if (!user) return;
      try {
        const pending = await getPendingScans();
        if (pending.length > 0) {
          const inserts = pending.map(p => ({ user_id: p.userId, batch_id: p.batchId }));
          await supabase.from("user_scans").insert(inserts);
          await clearPendingScans();
          fetchBatches(user.id);
          alert("📶 You are back online! Your offline scans have been synchronized with the network.");
        }
      } catch (err) {
        console.error("Failed to sync offline scans:", err);
      }
    };
    window.addEventListener("online", handleOnline);
    if (navigator.onLine) handleOnline();
    return () => window.removeEventListener("online", handleOnline);
  }, [user]);

  // 2. Fetch User's Scanned Entries and map to 'batches'
  const fetchBatches = async (userIdStr?: string) => {
    setLoading(true);
    const idToUse = userIdStr || user?.id;
    if (!idToUse) { setLoading(false); return; }

    const { data: scans, error: scanError } = await supabase
      .from("user_scans")
      .select("batch_id")
      .eq("user_id", idToUse)
      .order("scanned_at", { ascending: false });

    if (scanError || !scans || scans.length === 0) { setBatches([]); setLoading(false); return; }

    const batchIds = scans.map(s => s.batch_id);
    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .in("batch_id", batchIds)
      .order("created_at", { ascending: false });

    if (!error && data) setBatches(data);
    setLoading(false);
  };

  // 3. Process JSONB 'medicines' and filter by Expiry/Recall
  const processedData = useMemo(() => {
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);

    const inventory: any[] = [];
    const expiringSoon: any[] = [];
    const recalled: any[] = [];

    batches.forEach(batch => {
      const medList = Array.isArray(batch.medicines) ? batch.medicines : [];
      medList.forEach((med: any) => {
        const item = {
          batch_id: batch.batch_id,
          status: batch.status,
          name: med.name || "Unknown Medicine",
          quantity: med.quantity || "0",
          expiryDate: med.expiryDate || med.expiry_date || med.expiry,
          created_at: batch.created_at
        };
        inventory.push(item);
        if (batch.status === "Recalled") {
          recalled.push(item);
        } else if (item.expiryDate) {
          const exp = new Date(item.expiryDate);
          if (exp > today && exp <= thirtyDaysFromNow) expiringSoon.push(item);
        }
      });
    });

    // Expiry Risk Distribution
    let safeCount = 0, expiringSoonCount = 0, criticalCount = 0, expiredCount = 0;
    inventory.forEach(item => {
      if (!item.expiryDate) return;
      const expDate = new Date(item.expiryDate);
      const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) expiredCount++;
      else if (diffDays <= 30) criticalCount++;
      else if (diffDays <= 90) expiringSoonCount++;
      else safeCount++;
    });

    const expiryRiskData = [
      { name: "Safe (>90d)", count: safeCount, fill: "#10b981" },
      { name: "Soon (30-90d)", count: expiringSoonCount, fill: "#eab308" },
      { name: "Critical (<30d)", count: criticalCount, fill: "#f97316" },
      { name: "Expired", count: expiredCount, fill: "#ef4444" },
    ];

    const statusData = [
      { name: "Active", value: inventory.filter(i => i.status !== "Recalled").length, fill: "#10b981" },
      { name: "Recalled", value: recalled.length, fill: "#ef4444" },
    ].filter(d => d.value > 0);

    return { inventory, expiringSoon, recalled, expiryRiskData, statusData };
  }, [batches]);

  // 4. Feature Handlers
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchIdInput.trim()) return;

    if (!navigator.onLine) {
      if (user) await saveScanOffline(user.id, batchIdInput);
      setVerifyMessage("📶 Offline connection. Scan cached locally and will sync when reconnected.");
      setVerifyType("success");
      setVerificationResult({ batch_id: batchIdInput, status: "Pending Sync" });
      setBatchIdInput("");
      return;
    }

    setVerifyMessage("Querying blockchain ledger...");
    setVerifyType("");
    setVerificationResult(null);

    let isRecalledOnChain = false;
    setIsBlockchainSigning(true);
    try {
      const chainData = await getBatchFromBlockchain(batchIdInput);
      setIsBlockchainSigning(false);
      if (chainData && chainData.status === "Recalled") {
        isRecalledOnChain = true;
      } else if (!chainData) {
        throw new Error("Batch not found on chain");
      }
    } catch (err) {
      setIsBlockchainSigning(false);
      setVerifyMessage("❌ Counterfeit Alert: Batch ID does not exist on the Blockchain Ledger.");
      setVerifyType("error");
      setVerificationResult(null);
      return;
    }

    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .eq("batch_id", batchIdInput)
      .single();

    if (error || !data) {
      setVerifyMessage("❌ Details missing from off-chain database despite being on-chain.");
      setVerifyType("error");
      setVerificationResult(null);
    } else {
      if (isRecalledOnChain) data.status = "Recalled";

      // Log the receipt action to blockchain
      try {
        setIsBlockchainSigning(true);
        const txHash = await logBatchToBlockchain(batchIdInput, batchIdInput, data.medicines?.[0]?.name || "Unknown", "Received by Hospital");
        setBlockchainMsg(`Verified & logged on-chain! Hash: ${txHash.slice(0, 20)}...`);
      } catch (chainWriteErr) {
        console.warn("Blockchain receipt logging skipped:", chainWriteErr);
      } finally {
        setIsBlockchainSigning(false);
      }

      await supabase.from("user_scans").insert([{ user_id: user?.id, batch_id: batchIdInput }]);
      fetchBatches(user?.id);
      setVerificationResult(data);
      setVerifyType(data.status === "Recalled" ? "error" : "success");
      setVerifyMessage(data.status === "Recalled" ? "⚠️ RECALLED ON-CHAIN: Batch rejected. Do not use." : "✅ Authentic on Blockchain: Batch verified & added to inventory.");
    }
    setBatchIdInput("");
  };

  const handleSearchAlternatives = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "";
      const res = await fetch(`${baseUrl}/api/drug-info`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drugName: searchQuery, action: "getAlternatives" }),
      });
      if (!res.ok) throw new Error("Failed to fetch alternatives");
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to find alternatives");
    } finally {
      setAiLoading(false);
    }
  };

  const generateInsights = async () => {
    setLoadingInsights(true);
    setInsights([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const inventoryData = processedData.inventory.map(i => ({
        name: i.name, quantity: i.quantity, status: i.status, expiryDate: i.expiryDate
      }));
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ inventoryData }),
      });
      const data = await res.json();
      if (data.insights) setInsights(data.insights);
    } catch (err) {
      setInsights(["System Error: Could not reach Nexus AI node."]);
    }
    setLoadingInsights(false);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-3 rounded-lg border border-border shadow-2xl">
          <p className="text-foreground font-semibold mb-1">{label}</p>
          <p className="text-primary text-sm font-medium">{payload[0].name}: {payload[0].value}</p>
        </div>
      );
    }
    return null;
  };

  if (loading && batches.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Activity className="w-10 h-10 text-primary animate-spin" />
          <div className="text-xl font-medium tracking-tight">Connecting to Hospital Dashboard...</div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "Dashboard", icon: <LayoutDashboard size={20} />, label: "Overview" },
    { id: "Batch Verification", icon: <CheckCircle size={20} />, label: "Verify Batch" },
    { id: "Medicine Inventory", icon: <Package size={20} />, label: "Inventory" },
    { id: "Expiry Alerts", icon: <Bell size={20} />, label: "Expiry Alerts", count: processedData.expiringSoon.length },
    { id: "Recall Alerts", icon: <AlertTriangle size={20} />, label: "Recall Alerts", count: processedData.recalled.length },
    { id: "Alternatives", icon: <Search size={20} />, label: "AI Alternatives" },
    { id: "Settings", icon: <Download size={20} />, label: "Install App" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return (
          <div className="space-y-8 animate-fade-in relative z-10 pb-16 w-full">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Facility Overview</h2>
                <p className="text-muted-foreground mt-1 text-sm md:text-base">Real-time intelligence on your hospital's pharmaceutical inventory.</p>
              </div>
            </div>

            {/* AI Insights Panel */}
            <div className="glass-panel p-6 rounded-2xl border border-primary/20 bg-primary/5 animate-fade-in relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
              <div className="flex justify-between items-center mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 text-primary shadow-lg shadow-primary/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground tracking-tight">AI Inventory Insights</h3>
                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase mt-0.5">Predictive Restock Models</p>
                  </div>
                </div>
                <button onClick={generateInsights} disabled={loadingInsights} className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-foreground px-6 py-3 rounded-xl font-bold shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all flex items-center gap-2 text-xs uppercase tracking-widest active:scale-[0.98]">
                  {loadingInsights ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  {loadingInsights ? "Analyzing..." : "Generate Insights"}
                </button>
              </div>
              <div className="space-y-3 relative z-10">
                {insights.length > 0 ? (
                  insights.map((insight, idx) => (
                    <div key={idx} className="p-5 rounded-2xl bg-card border border-border flex items-start gap-4 animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30 text-xs font-black">{idx + 1}</div>
                      <p className="text-sm text-foreground leading-relaxed pt-0.5">{insight}</p>
                    </div>
                  ))
                ) : (
                  <div className="p-10 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-card flex flex-col items-center justify-center">
                    <Sparkles className="w-8 h-8 opacity-20 mb-3" />
                    <span className="text-sm uppercase tracking-wider font-semibold">AI is ready to analyze inventory health.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 border border-blue-500/20 relative overflow-hidden">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-blue-500/10">
                  <Package className="text-blue-500 w-8 h-8" />
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1">Total Inventory</p>
                  <h4 className="text-4xl font-black text-blue-400">{processedData.inventory.length}</h4>
                </div>
              </div>
              <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 border border-amber-500/20 relative overflow-hidden">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-amber-500/10">
                  <Clock className="text-amber-500 w-8 h-8" />
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1">Expiring Soon (&lt;30d)</p>
                  <h4 className="text-4xl font-black text-amber-400">{processedData.expiringSoon.length}</h4>
                </div>
              </div>
              <div className="glass-panel p-6 rounded-2xl flex items-center gap-5 border border-red-500/20 relative overflow-hidden">
                <div className="w-14 h-14 rounded-full flex items-center justify-center bg-red-500/10">
                  <AlertTriangle className="text-red-500 w-8 h-8" />
                </div>
                <div>
                  <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1">Recalled Batches</p>
                  <h4 className="text-4xl font-black text-red-400">{processedData.recalled.length}</h4>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-6 flex flex-col h-[380px]">
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">Inventory Status</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={processedData.statusData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none">
                        {processedData.statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ color: "var(--foreground)" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 flex flex-col h-[380px]">
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">Expiry Risk Distribution</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={processedData.expiryRiskData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                      <Bar dataKey="count" name="Count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                        {processedData.expiryRiskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Live Inventory Table Preview */}
            <div className="glass-panel rounded-2xl border border-border shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border bg-white/5 flex justify-between items-center">
                <h3 className="font-semibold text-foreground tracking-wide uppercase text-sm">Live Inventory (Recent)</h3>
                <button onClick={() => fetchBatches(user?.id)} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Sync Inventory
                </button>
              </div>
              <InventoryTable data={processedData.inventory.slice(0, 10)} />
            </div>
          </div>
        );

      case "Batch Verification":
        return (
          <div className="max-w-2xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 text-center">Blockchain Batch Verification</h2>
            <div className="glass-panel p-10 rounded-3xl border border-border shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
              <p className="text-muted-foreground mb-8">Enter the Batch ID to verify on-chain authenticity and add it to your hospital inventory.</p>

              {isBlockchainSigning && (
                <div className="mb-6 flex items-center justify-center gap-2 text-amber-400 text-sm font-bold animate-pulse bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-xl">
                  <Link className="w-4 h-4" /> Querying Blockchain Ledger...
                </div>
              )}

              <form onSubmit={handleVerify} className="space-y-6 relative z-10">
                <input
                  type="text"
                  placeholder="ENTER BATCH ID (E.G. BATCH-2026-X)"
                  value={batchIdInput}
                  onChange={(e) => setBatchIdInput(e.target.value)}
                  className="w-full p-4 bg-card border border-border rounded-xl text-center text-lg font-mono outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground transition-all uppercase tracking-widest"
                />
                <button className="w-full bg-primary hover:bg-primary/90 text-foreground py-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide font-bold flex items-center justify-center gap-2">
                  <ShieldCheck className="w-5 h-5" /> Verify on Blockchain
                </button>
              </form>

              {verifyMessage && (
                <div className={`mt-8 p-4 rounded-xl text-sm font-medium animate-slide-up flex items-center justify-center gap-2 border ${verifyType === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {verifyType === 'success' ? <ShieldCheck className="w-5 h-5 shrink-0" /> : <ShieldAlert className="w-5 h-5 shrink-0" />}
                  {verifyMessage}
                </div>
              )}

              {blockchainMsg && (
                <div className="mt-4 p-3 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                  <Link className="w-4 h-4 shrink-0" /> {blockchainMsg}
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
        );

      case "Medicine Inventory":
        return (
          <div className="glass-panel rounded-2xl border border-border shadow-2xl overflow-hidden animate-fade-in relative z-10">
            <div className="p-6 border-b border-border bg-white/5 flex justify-between items-center">
              <h3 className="font-semibold text-foreground tracking-wide uppercase text-sm">Complete Inventory ({processedData.inventory.length} items)</h3>
              <button onClick={() => fetchBatches(user?.id)} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3 h-3" /> Refresh
              </button>
            </div>
            <InventoryTable data={processedData.inventory} />
          </div>
        );

      case "Expiry Alerts":
        return (
          <div className="max-w-5xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 flex items-center gap-3">
              <Clock className="w-8 h-8 text-amber-500" /> Expiry Alerts
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {processedData.expiringSoon.length === 0 ? (
                <div className="glass-panel border border-border p-16 text-center rounded-2xl text-emerald-500/70 text-sm tracking-wider uppercase">
                  <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" /> System Nominal. No critical items detected.
                </div>
              ) : processedData.expiringSoon.map((item, i) => <AlertCard key={i} item={item} type="expiry" />)}
            </div>
          </div>
        );

      case "Recall Alerts":
        return (
          <div className="max-w-5xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-red-500" /> Recalled Batches
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {processedData.recalled.length === 0 ? (
                <div className="glass-panel border border-border p-16 text-center rounded-2xl text-emerald-500/70 text-sm tracking-wider uppercase">
                  <CheckCircle className="w-8 h-8 mx-auto mb-3 opacity-50" /> Inventory secure. No recalled batches.
                </div>
              ) : processedData.recalled.map((item, i) => <AlertCard key={i} item={item} type="recall" />)}
            </div>
          </div>
        );

      case "Alternatives":
        return (
          <div className="max-w-3xl mx-auto space-y-8 animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-2">Smart Substitute Index</h2>
            <p className="text-muted-foreground mb-8">AI-driven mapping for chemically similar compounds when primary stock is unavailable.</p>
            <form onSubmit={handleSearchAlternatives} className="flex gap-3">
              <input
                type="text"
                placeholder="Query required compound (e.g. Paracetamol)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 p-4 bg-card border border-border rounded-xl text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary transition-all"
              />
              <button disabled={aiLoading} className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-foreground px-8 rounded-xl font-medium shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] flex items-center gap-2">
                {aiLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <Search size={16} />}
                {aiLoading ? "Querying..." : "Query"}
              </button>
            </form>

            {aiError && (
              <div className="p-4 rounded-xl text-xs font-bold mb-6 flex items-start gap-3 bg-red-500/10 border border-red-500/20 text-red-500">
                <AlertTriangle size={18} /><span className="leading-relaxed">{aiError}</span>
              </div>
            )}

            {aiResult && (
              <div className="space-y-6 animate-slide-up">
                <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black text-foreground mb-1">{aiResult.name}</h3>
                    <p className="text-primary font-bold text-sm mb-4">Generic: {aiResult.genericName}</p>
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2">Purpose</h4>
                      <p className="text-sm text-foreground/80 leading-relaxed bg-background/50 p-4 rounded-xl border border-border/50">{aiResult.purpose}</p>
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
                        const inStockMatch = processedData.inventory.find((med: any) => med?.name?.toLowerCase().includes(alt?.name?.toLowerCase()));
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
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-1.5 rounded-full font-bold text-xs tracking-wider uppercase">Inventory: {stockCount}</span>
                            ) : (
                              <span className="bg-red-500/10 text-red-500/70 border border-red-500/20 px-4 py-1.5 rounded-full font-bold text-xs tracking-wider uppercase">Not in Inventory</span>
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
        );

      case "Settings":
        return (
          <div className="max-w-2xl mx-auto space-y-8 animate-fade-in relative z-10 text-center py-10">
            <div className="w-20 h-20 bg-primary/20 text-primary mx-auto rounded-full flex items-center justify-center mb-6 border border-primary/30">
              <Download size={40} />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Install App (.APK / PWA)</h2>
            <p className="text-muted-foreground text-lg mb-8">Install the PharmaVerify platform on your device for quick access and offline QR scanning capabilities.</p>
            <button
              onClick={() => window.dispatchEvent(new Event("trigger-install"))}
              className="bg-primary hover:bg-primary/90 text-white font-bold py-4 px-10 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all text-lg"
            >
              Download & Install App
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden selection:bg-primary/30">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 glass border-r border-border flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 shrink-0`}>
        <div className="p-8 border-b border-border flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-primary rounded-xl flex items-center justify-center text-foreground font-bold mr-4 shadow-lg shadow-blue-500/20">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none text-foreground">PharmaDash</h1>
              <span className="text-xs text-blue-400 font-medium uppercase tracking-wider mt-1 block">Hospital Dashboard</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-muted-foreground hover:text-foreground"><X className="w-6 h-6" /></button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-2">
          {tabs.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }} className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 relative group overflow-hidden ${isActive ? "text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                {isActive && <div className="absolute inset-0 bg-primary opacity-100" />}
                {!isActive && <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />}
                <div className="flex items-center gap-4 relative z-10 transition-colors">
                  <span className={`${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-primary"}`}>{item.icon}</span>
                  <span className="tracking-wide text-sm font-medium">{item.label}</span>
                </div>
                {item.count ? (
                  <span className={`relative z-10 text-[10px] px-2.5 py-1 rounded-full font-bold shadow-sm ${isActive ? "bg-white text-primary" : "bg-red-500/20 text-red-400 border border-red-500/30"}`}>
                    {item.count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-border bg-card">
          <button onClick={handleLogout} className="flex items-center gap-3 text-muted-foreground hover:text-red-400 w-full transition-colors font-medium text-sm">
            <LogOut size={18} /> Terminate Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative z-10 w-full overflow-hidden">
        <header className="px-4 lg:px-10 py-4 lg:py-6 border-b border-border flex justify-between items-center backdrop-blur-md bg-background/50 sticky top-0 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"><Menu className="w-6 h-6" /></button>
            <div className="w-2 h-2 rounded-full hidden lg:block bg-emerald-500 animate-pulse" />
            <h2 className="hidden lg:block text-sm tracking-wider uppercase font-bold text-foreground opacity-90">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="text-sm text-muted-foreground bg-card border border-border px-4 py-2 rounded-full font-medium">
              Active User: <span className="text-foreground ml-1">{user?.email}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar w-full">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function InventoryTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left whitespace-nowrap">
        <thead>
          <tr className="bg-card text-muted-foreground text-[10px] uppercase font-bold tracking-widest border-b border-border">
            <th className="px-8 py-5">Medicine</th>
            <th className="px-8 py-5">Batch ID</th>
            <th className="px-8 py-5">Quantity</th>
            <th className="px-8 py-5">Expiry Date</th>
            <th className="px-8 py-5">Status</th>
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
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${item.status === 'Recalled' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                  {item.status}
                </span>
              </td>
            </tr>
          )) : (
            <tr><td colSpan={5} className="py-12 text-center text-muted-foreground text-sm uppercase tracking-wider">No active inventory details.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function AlertCard({ item, type }: { item: any, type: 'expiry' | 'recall' }) {
  const isRecall = type === 'recall';
  return (
    <div className={`p-6 rounded-2xl flex justify-between items-center shadow-lg border relative overflow-hidden ${isRecall ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
      <div className={`absolute top-0 right-0 w-32 h-32 blur-[60px] pointer-events-none rounded-full ${isRecall ? 'bg-red-500/10' : 'bg-amber-500/10'}`} />
      <div className="flex gap-5 items-center relative z-10">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border ${isRecall ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-500'}`}>
          {isRecall ? <AlertTriangle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
        </div>
        <div>
          <h4 className="font-bold text-foreground text-lg capitalize">{item.name}</h4>
          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Batch ID: <span className="text-primary font-mono">{item.batch_id}</span></p>
        </div>
      </div>
      <div className="text-right relative z-10">
        <p className={`font-black text-xl tracking-wide uppercase ${isRecall ? 'text-red-400' : 'text-amber-500'}`}>
          {isRecall ? 'RECALLED' : 'EXPIRING'}
        </p>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">Expiry: {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "N/A"}</p>
      </div>
    </div>
  );
}