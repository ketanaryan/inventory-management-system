"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import ThemeToggle from "@/components/ThemeToggle";
import { User } from "@supabase/supabase-js";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import {
  LayoutDashboard,
  PlusCircle,
  AlertTriangle,
  History,
  Clock,
  QrCode,
  LogOut,
  Search,
  Activity,
  Package,
  ShieldAlert,
  Download,
  Trash2,
  Sparkles,
  RefreshCw,
  Zap,
} from "lucide-react";

type MedicineEntry = {
  name: string;
  quantity: string;
  expiryDate: string;
};

export default function ManufacturerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [activeTab, setActiveTab] = useState("Dashboard");

  // AI State
  const [insights, setInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Forms Output
  const [batchId, setBatchId] = useState("");
  const [medicines, setMedicines] = useState<MedicineEntry[]>([
    { name: "", quantity: "", expiryDate: "" },
  ]);
  const [qrValue, setQrValue] = useState("");
  const [registerMessage, setRegisterMessage] = useState({ text: "", type: "" });

  const [recallBatchId, setRecallBatchId] = useState("");
  const [recallMessage, setRecallMessage] = useState({ text: "", type: "" });

  // Data State
  const [batches, setBatches] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
        setLoadingUser(false);
      }
    };
    fetchUser();
  }, [router]);

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const fetchBatches = async () => {
    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setBatches(data);
    }
  };

  const generateInsights = async () => {
    setLoadingInsights(true);
    setInsights([]);
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inventoryData: batches }),
      });
      const data = await res.json();
      if (data.insights) setInsights(data.insights);
    } catch (err) {
      setInsights(["System Error: Could not reach Nexus AI node."]);
    }
    setLoadingInsights(false);
  };

  const handleMedicineChange = (
    index: number,
    field: keyof MedicineEntry,
    value: string
  ) => {
    const newMedicines = [...medicines];
    newMedicines[index][field] = value;
    setMedicines(newMedicines);
  };

  const addMedicineEntry = () => {
    setMedicines([...medicines, { name: "", quantity: "", expiryDate: "" }]);
  };

  const removeMedicineEntry = (index: number) => {
    const newMedicines = medicines.filter((_, i) => i !== index);
    setMedicines(newMedicines);
  };

  const handleRegisterBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterMessage({ text: "", type: "" });
    setQrValue("");

    if (!batchId.trim()) {
      setRegisterMessage({ text: "Batch ID is required.", type: "error" });
      return;
    }

    if (
      medicines.some(
        (med) => !med.name.trim() || !med.quantity || !med.expiryDate
      )
    ) {
      setRegisterMessage({
        text: "All medicine fields are required.",
        type: "error",
      });
      return;
    }

    try {
      const { error } = await supabase.from("batches").insert([
        {
          batch_id: batchId,
          status: "Active",
          medicines: medicines,
        },
      ]);

      if (error) throw error;

      const verificationUrl = `${window.location.origin}/verify/${batchId}`;
      setQrValue(verificationUrl);
      setRegisterMessage({
        text: "Batch registered successfully!",
        type: "success",
      });
      setBatchId("");
      setMedicines([{ name: "", quantity: "", expiryDate: "" }]);
      fetchBatches();
    } catch (error: any) {
      setRegisterMessage({
        text: `Failed to register batch: ${
          error.message || "Conflict or connection issue"
        }`,
        type: "error",
      });
    }
  };

  const handleRecallBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecallMessage({ text: "", type: "" });

    if (!recallBatchId.trim()) {
      setRecallMessage({
        text: "Please enter a Phase/Batch ID to recall.",
        type: "error",
      });
      return;
    }

    try {
      const { data, error: selectError } = await supabase
        .from("batches")
        .select("batch_id")
        .eq("batch_id", recallBatchId)
        .single();

      if (selectError || !data) {
        throw new Error("Batch not found.");
      }

      const { error: updateError } = await supabase
        .from("batches")
        .update({ status: "Recalled" })
        .eq("batch_id", recallBatchId);

      if (updateError) throw updateError;

      setRecallMessage({
        text: `Batch ${recallBatchId} recalled successfully!`,
        type: "success",
      });
      setRecallBatchId("");
      fetchBatches();
    } catch (error: any) {
      setRecallMessage({
        text: `Recall failed: ${error.message}`,
        type: "error",
      });
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById(
      "qr-preview-canvas"
    ) as HTMLCanvasElement;
    if (canvas) {
      const pngUrl = canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      let downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR_${batchId || "batch"}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    }
  };


  // Analytics Calculations
  const totalBatches = batches.length;
  const recalledBatches = batches.filter((b) => b.status === "Recalled").length;
  const activeBatches = totalBatches - recalledBatches;

  const pieChartData = [
    { name: "Active", value: activeBatches },
    { name: "Suspended", value: recalledBatches },
  ];
  const pieColors = ["#10b981", "#f59e0b"]; // emerald-500, amber-500

  const batchesPerDay: Record<string, number> = {};
  batches.forEach((batch) => {
    if (!batch.created_at) return;
    const date = new Date(batch.created_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    batchesPerDay[date] = (batchesPerDay[date] || 0) + 1;
  });
  const lineChartData = Object.keys(batchesPerDay)
    .map((date) => ({
      date,
      batches: batchesPerDay[date],
    }))
    .reverse();

  const medicineCounts: Record<string, number> = {};
  batches.forEach((batch) => {
    batch.medicines?.forEach((med: MedicineEntry) => {
      const name = med.name.trim();
      const qty = Number(med.quantity);
      if (name && !isNaN(qty)) {
        medicineCounts[name] = (medicineCounts[name] || 0) + qty;
      }
    });
  });
  const barChartData = Object.keys(medicineCounts)
    .map((name) => ({
      name,
      quantity: medicineCounts[name],
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 10);

  // Expiry Risk Calculation
  const today = new Date();
  let safeCount = 0;
  let expiringSoonCount = 0;
  let criticalCount = 0;
  let expiredCount = 0;

  batches.forEach((batch) => {
    batch.medicines?.forEach((med: MedicineEntry) => {
      if (!med.expiryDate) return;
      const expDate = new Date(med.expiryDate);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays < 0) {
        expiredCount++;
      } else if (diffDays <= 30) {
        criticalCount++;
      } else if (diffDays <= 90) {
        expiringSoonCount++;
      } else {
        safeCount++;
      }
    });
  });

  const expiryRiskData = [
    { name: "Safe (>90d)", count: safeCount, fill: "#10b981" },
    { name: "Soon (30-90d)", count: expiringSoonCount, fill: "#eab308" },
    { name: "Critical (<30d)", count: criticalCount, fill: "#f97316" },
    { name: "Expired", count: expiredCount, fill: "#ef4444" },
  ];

  // Expiry Alerts Table Data
  const expiringMedicines: any[] = [];
  batches.forEach((batch) => {
    batch.medicines?.forEach((med: MedicineEntry) => {
      if (!med.expiryDate) return;
      const expDate = new Date(med.expiryDate);
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30) {
        expiringMedicines.push({
          batch_id: batch.batch_id,
          name: med.name,
          expiryDate: med.expiryDate,
          daysLeft: diffDays,
        });
      }
    });
  });
  expiringMedicines.sort((a, b) => a.daysLeft - b.daysLeft);

  const filteredBatches = batches.filter((batch) =>
    batch.batch_id.toLowerCase().includes(search.toLowerCase())
  );

  // Custom Tooltip for Charts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass-panel p-3 rounded-lg border border-border shadow-2xl">
          <p className="text-foreground font-semibold mb-1">{label}</p>
          <p className="text-primary text-sm font-medium">
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Activity className="w-10 h-10 text-primary animate-spin" />
          <div className="text-xl font-medium tracking-tight">
            Initializing PharmaDash Secure Core...
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return (
          <div className="space-y-8 animate-fade-in relative z-10 pb-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">
                  Overview Insight
                </h2>
                <p className="text-muted-foreground mt-1">
                  Real-time intelligence on your supply network.
                </p>
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
                      <h3 className="text-lg font-bold text-foreground tracking-tight">Nexus AI Analysis</h3>
                      <p className="text-[10px] text-primary font-bold tracking-widest uppercase mt-0.5">Strategic Operations Node</p>
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
                     <div key={idx} className="p-5 rounded-2xl bg-card border border-border flex items-start gap-4 animate-slide-up shadow-inner" style={{ animationDelay: `${idx * 100}ms` }}>
                        <div className="w-7 h-7 rounded-full bg-primary/20 text-primary flex items-center justify-center shrink-0 border border-primary/30 text-xs font-black shadow-[0_0_10px_rgba(139,92,246,0.2)]">
                           {idx + 1}
                        </div>
                        <p className="text-sm text-foreground leading-relaxed pt-0.5">{insight}</p>
                     </div>
                   ))
                 ) : (
                   <div className="p-10 text-center text-muted-foreground border border-dashed border-border rounded-2xl bg-card flex flex-col items-center justify-center">
                      <Sparkles className="w-8 h-8 opacity-20 mb-3" />
                      <span className="text-sm uppercase tracking-wider font-semibold">Nexus AI is standing by to analyze current network state.</span>
                   </div>
                 )}
               </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Package className="w-16 h-16 text-foreground" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                  Total Batches
                </p>
                <div className="flex items-end gap-3">
                  <h3 className="text-4xl font-bold text-foreground">
                    {totalBatches}
                  </h3>
                  <span className="text-sm text-primary mb-1">Registered</span>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Activity className="w-16 h-16 text-emerald-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                  Active Lifecycle
                </p>
                <div className="flex items-end gap-3">
                  <h3 className="text-4xl font-bold text-emerald-400">
                    {activeBatches}
                  </h3>
                  <span className="text-sm text-emerald-500/70 mb-1">
                    Currently Valid
                  </span>
                </div>
              </div>

              <div className="glass-panel p-6 rounded-2xl flex flex-col justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldAlert className="w-16 h-16 text-amber-500" />
                </div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">
                  Suspended Nodes
                </p>
                <div className="flex items-end gap-3">
                  <h3 className="text-4xl font-bold text-amber-400">
                    {recalledBatches}
                  </h3>
                  <span className="text-sm text-amber-500/70 mb-1">
                    System Audits
                  </span>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-6 flex flex-col h-[400px]">
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">
                  Status Distribution
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={pieColors[index % pieColors.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ color: "var(--foreground)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 flex flex-col h-[400px]">
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">
                  Batch Production Over Time
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={lineChartData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="batches"
                        name="Batches"
                        stroke="#8b5cf6"
                        strokeWidth={4}
                        dot={{
                          stroke: "#8b5cf6",
                          strokeWidth: 2,
                          r: 4,
                          fill: "#09090b",
                        }}
                        activeDot={{ r: 6, fill: "#8b5cf6", strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 flex flex-col h-[400px]">
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">
                  Top Medicines (Volume)
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={barChartData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="colorUv"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={1} />
                          <stop
                            offset="95%"
                            stopColor="#8b5cf6"
                            stopOpacity={0.3}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                      <Bar
                        dataKey="quantity"
                        name="Quantity"
                        fill="url(#colorUv)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 flex flex-col h-[400px]">
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">
                  Expiry Risk Distribution
                </h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={expiryRiskData}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        tick={{ fill: "#a1a1aa", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                        dx={-10}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                      <Bar
                        dataKey="count"
                        name="Count"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={50}
                      >
                        {expiryRiskData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );

      case "Register Batch":
        return (
          <div className="max-w-4xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8">
              Register New Batch
            </h2>
            <div className="glass-panel rounded-2xl p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />

              {registerMessage.text && (
                <div
                  className={`mb-8 p-4 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-3 border ${
                    registerMessage.type === "error"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {registerMessage.type === "error" ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <Activity className="w-5 h-5" />
                  )}
                  {registerMessage.text}
                </div>
              )}

              <form onSubmit={handleRegisterBatch} className="space-y-8 relative z-10">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Global Batch Identifier
                  </label>
                  <input
                    type="text"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    placeholder="e.g. BATCH-2026-NEXUS"
                    className="w-full px-5 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-muted-foreground">
                      Package Inventory
                    </label>
                    <button
                      type="button"
                      onClick={addMedicineEntry}
                      className="text-sm font-medium text-primary hover:text-primary/80 flex items-center gap-2 transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" /> Add Substance
                    </button>
                  </div>

                  {medicines.map((medicine, index) => (
                    <div
                      key={index}
                      className="bg-card p-6 rounded-xl border border-border relative group transition-all hover:border-primary/30"
                    >
                      {medicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMedicineEntry(index)}
                          className="absolute -top-3 -right-3 bg-card text-muted-foreground hover:text-red-400 border border-border rounded-full p-2 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-5">
                          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                            Chemical / Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Paracetamol 500mg"
                            value={medicine.name}
                            onChange={(e) =>
                              handleMedicineChange(index, "name", e.target.value)
                            }
                            className="w-full px-4 py-3 bg-white/5 text-sm border border-transparent rounded-lg focus:ring-1 focus:ring-primary outline-none text-foreground placeholder:text-muted"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                            Volume
                          </label>
                          <input
                            type="number"
                            placeholder="Units"
                            min="1"
                            value={medicine.quantity}
                            onChange={(e) =>
                              handleMedicineChange(
                                index,
                                "quantity",
                                e.target.value
                              )
                            }
                            className="w-full px-4 py-3 bg-white/5 text-sm border border-transparent rounded-lg focus:ring-1 focus:ring-primary outline-none text-foreground placeholder:text-muted"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                            Expiration Constraint
                          </label>
                          <input
                            type="date"
                            value={medicine.expiryDate}
                            onChange={(e) =>
                              handleMedicineChange(
                                index,
                                "expiryDate",
                                e.target.value
                              )
                            }
                            className="w-full px-4 py-3 bg-white/5 text-sm border border-transparent rounded-lg focus:ring-1 focus:ring-primary outline-none text-foreground [color-scheme:dark]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary/90 text-foreground font-medium py-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide"
                  >
                    Commit to Network
                  </button>
                </div>
              </form>

              {qrValue && (
                <div className="mt-12 pt-8 border-t border-border flex flex-col items-center animate-slide-up">
                  <p className="text-sm font-semibold text-primary mb-6 uppercase tracking-widest">
                    Verification Artifact Generated
                  </p>
                  <div className="bg-white p-6 rounded-2xl shadow-[0_0_40px_rgba(139,92,246,0.2)]">
                    <QRCodeCanvas
                      value={qrValue}
                      size={200}
                      fgColor="#09090b"
                      level="H"
                    />
                  </div>
                  <p className="mt-6 text-sm text-muted-foreground text-center max-w-md">
                    Secure trace recorded. Use QR Tools to export this high-fidelity code for physical labeling.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case "Suspend Batch":
        return (
          <div className="max-w-3xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 flex items-center gap-3">
              <ShieldAlert className="text-amber-500 w-8 h-8" />
              Suspend Protocol (Audit)
            </h2>
            <div className="glass-panel border-amber-500/20 rounded-2xl p-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

              {recallMessage.text && (
                <div
                  className={`mb-8 p-4 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-3 border ${
                    recallMessage.type === "error"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                   <AlertTriangle className="w-5 h-5 shrink-0" />
                  {recallMessage.text}
                </div>
              )}

              <form onSubmit={handleRecallBatch} className="space-y-8 relative z-10">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">
                    Target Batch Identifier
                  </label>
                  <input
                    type="text"
                    value={recallBatchId}
                    onChange={(e) => setRecallBatchId(e.target.value)}
                    placeholder="Enter strictly matched ID..."
                    className="w-full px-5 py-4 bg-card border border-amber-500/30 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground"
                  />
                  <div className="mt-4 p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200 leading-relaxed">
                      <strong>Audit Action:</strong> This suspends the batch across the supply chain ledger for inspection. The status will be marked for review.
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-600 hover:bg-amber-700 text-foreground font-medium py-4 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-[0.98] tracking-wide"
                >
                  Execute Global Suspension
                </button>
              </form>
            </div>
          </div>
        );

      case "Batch History":
        return (
          <div className="max-w-7xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8">
              Ledger History
            </h2>
            <div className="glass-panel border-border rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-border bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full max-w-md">
                  <input
                    type="text"
                    placeholder="Search ledger entries..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground transition-all"
                  />
                  <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-card border-b border-border text-muted-foreground">
                    <tr>
                      <th className="px-8 py-5 font-semibold uppercase tracking-wider text-xs">Hash / ID</th>
                      <th className="px-8 py-5 font-semibold uppercase tracking-wider text-xs">Timestamp</th>
                      <th className="px-8 py-5 font-semibold uppercase tracking-wider text-xs">Payload Array</th>
                      <th className="px-8 py-5 font-semibold uppercase tracking-wider text-xs">Consensus Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filteredBatches.length > 0 ? (
                      filteredBatches.map((batch) => (
                        <tr
                          key={batch.batch_id}
                          className="hover:bg-muted transition-colors group"
                        >
                          <td className="px-8 py-5 font-mono text-primary font-medium tracking-tight">
                            {batch.batch_id}
                          </td>
                          <td className="px-8 py-5 text-muted-foreground">
                            {batch.created_at
                              ? new Date(batch.created_at).toLocaleString()
                              : "Unknown"}
                          </td>
                          <td className="px-8 py-5 text-muted-foreground">
                            <span className="bg-white/10 px-3 py-1 rounded-full text-xs">
                              {batch.medicines?.length || 0} entities
                            </span>
                          </td>
                          <td className="px-8 py-5">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide border ${
                                batch.status === "Recalled"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              }`}
                            >
                              {batch.status === "Recalled" && <ShieldAlert className="w-3 h-3 mr-1.5" />}
                              {batch.status === "Recalled" ? "Suspended" : batch.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-8 py-24 text-center text-muted-foreground"
                        >
                          No cryptographic entries matched your criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "Expiry Alerts":
        return (
          <div className="max-w-6xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 flex items-center gap-3">
               <Clock className="w-8 h-8 text-amber-500" />
               Temporal Risk Analysis
            </h2>
            <div className="glass-panel border-border rounded-2xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-border bg-amber-500/5">
                <h3 className="text-sm font-medium text-amber-200 flex items-center gap-2">
                   <AlertTriangle className="w-4 h-4" />
                   Active compounds deteriorating within a 30-day window
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-card border-b border-border text-muted-foreground">
                    <tr>
                      <th className="px-8 py-5 font-semibold uppercase tracking-wider text-xs">Parent Node</th>
                      <th className="px-8 py-5 font-semibold uppercase tracking-wider text-xs">Substance</th>
                      <th className="px-8 py-5 font-semibold uppercase tracking-wider text-xs">Threshold Date</th>
                      <th className="px-8 py-5 font-semibold uppercase tracking-wider text-xs">Vector</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {expiringMedicines.length > 0 ? (
                      expiringMedicines.map((med, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-muted transition-colors"
                        >
                          <td className="px-8 py-5 font-mono text-primary font-medium">
                            {med.batch_id}
                          </td>
                          <td className="px-8 py-5 text-foreground font-medium">
                            {med.name}
                          </td>
                          <td className="px-8 py-5 text-muted-foreground">
                            {new Date(med.expiryDate).toISOString().split('T')[0]}
                          </td>
                          <td className="px-8 py-5">
                            {med.daysLeft < 0 ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                                ☠ Payload Expired
                              </span>
                            ) : med.daysLeft <= 14 ? (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                ⚠ Critical (T-{med.daysLeft}d)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                ⚡ Warning (T-{med.daysLeft}d)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-8 py-24 text-center text-emerald-500/70"
                        >
                           <Activity className="w-8 h-8 mx-auto mb-3 opacity-50" />
                          System nominal. All registered assets have secure margins.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "QR Tools":
        return (
          <div className="max-w-3xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8">
              Verification Matrix
            </h2>
            <div className="glass-panel border-border rounded-2xl p-10 text-center flex flex-col items-center shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />

              <p className="text-muted-foreground mb-10 max-w-lg leading-relaxed relative z-10">
                Generate and extract high-fidelity spatial configurations (QR) for active nexus nodes. Used for physical package alignment.
              </p>

              <div className="w-full max-w-sm mb-10 text-left relative z-10">
                <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Target Identity Hash
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    placeholder="Enter valid Node ID..."
                    className="w-full pl-11 pr-4 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-foreground transition-all"
                  />
                  <QrCode className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {batchId ? (
                <div className="flex flex-col items-center animate-scale-in relative z-10">
                  <div className="bg-white p-6 rounded-2xl shadow-[0_0_50px_rgba(139,92,246,0.15)] mb-8">
                    <QRCodeCanvas
                      id="qr-preview-canvas"
                      value={`${window.location.origin}/verify/${batchId}`}
                      size={240}
                      fgColor="#09090b"
                      level="H"
                    />
                  </div>
                  <button
                    onClick={downloadQR}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-foreground font-medium py-3 px-8 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98]"
                  >
                    <Download className="w-5 h-5" />
                    Extract Vector Graphic
                  </button>
                </div>
              ) : (
                <div className="py-20 text-muted-foreground border-2 border-dashed border-border w-full rounded-2xl relative z-10 bg-card">
                   <QrCode className="w-10 h-10 mx-auto mb-3 opacity-20" />
                  Awaiting spatial hash input...
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const navItems = [
    { name: "Dashboard", icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: "Register Batch", icon: <PlusCircle className="w-5 h-5" /> },
    { name: "Suspend Batch", icon: <ShieldAlert className="w-5 h-5" /> },
    { name: "Batch History", icon: <History className="w-5 h-5" /> },
    { name: "Expiry Alerts", icon: <Clock className="w-5 h-5" /> },
    { name: "QR Tools", icon: <QrCode className="w-5 h-5" /> },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden selection:bg-primary/30">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      {/* Sidebar */}
      <aside className="w-72 glass border-r border-border flex flex-col z-20 shrink-0 relative">
        <div className="p-8 border-b border-border flex items-center">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-blue-600 rounded-xl flex items-center justify-center text-foreground font-bold mr-4 shadow-lg shadow-primary/20">
             <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight leading-none">
              PharmaDash
            </h1>
            <span className="text-xs text-primary font-medium uppercase tracking-wider mt-1 block">
              Node Commander
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-2">
          {navItems.map((item) => {
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() => setActiveTab(item.name)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 text-sm font-medium rounded-xl transition-all duration-300 relative group overflow-hidden ${
                  isActive
                    ? "text-primary-foreground shadow-lg"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-primary opacity-100" />
                )}
                {/* Subtle hover gradient for inactive items */}
                {!isActive && (
                   <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                )}

                <span
                  className={`relative z-10 transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-primary"
                  }`}
                >
                  {item.icon}
                </span>
                <span className="relative z-10 tracking-wide">{item.name}</span>
              </button>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="p-6 border-t border-border bg-card mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">
                Active Session
              </span>
              <span className="text-sm font-medium text-foreground truncate max-w-[150px]" title={user?.email || ""}>
                {user?.email}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg bg-white/5 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
              title="Terminate Session"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        
        {/* Header */}
        <header className="px-10 py-6 border-b border-border flex justify-between items-center shrink-0 z-10 backdrop-blur-md bg-background/50 sticky top-0">
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-sm font-medium text-emerald-500 tracking-wider uppercase">System Online</span>
          </div>
          <div className="flex items-center gap-6">
             <ThemeToggle />
             <div className="text-sm text-muted-foreground">
                Node ID: <span className="font-mono text-foreground ml-1">#NX-8829</span>
             </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
          {renderContent()}
        </main>
      </div>

    </div>
  );
}