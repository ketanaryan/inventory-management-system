"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
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
  Bar
} from "recharts";

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

  // Forms Output
  const [batchId, setBatchId] = useState("");
  const [medicines, setMedicines] = useState<MedicineEntry[]>([
    { name: "", quantity: "", expiryDate: "" },
  ]);
  const [qrValue, setQrValue] = useState("");
  const [registerMessage, setRegisterMessage] = useState({ text: "", type: "" });

  const [recallBatchId, setRecallBatchId] = useState("");
  const [recallMessage, setRecallMessage] = useState({ text: "", type: "" });

  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

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

  const handleMedicineChange = (index: number, field: keyof MedicineEntry, value: string) => {
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

    if (medicines.some((med) => !med.name.trim() || !med.quantity || !med.expiryDate)) {
      setRegisterMessage({ text: "All medicine fields are required.", type: "error" });
      return;
    }

    try {
      const { error } = await supabase.from("batches").insert([
        { 
          batch_id: batchId, 
          status: "Active",
          medicines: medicines 
        }
      ]);

      if (error) throw error;

      const verificationUrl = `${window.location.origin}/verify/${batchId}`;
      setQrValue(verificationUrl);
      setRegisterMessage({ text: "Batch registered successfully!", type: "success" });
      setBatchId("");
      setMedicines([{ name: "", quantity: "", expiryDate: "" }]);
      fetchBatches();
    } catch (error: any) {
      setRegisterMessage({ text: `Failed to register batch: ${error.message || "Conflict or connection issue"}`, type: "error" });
    }
  };

  const handleRecallBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecallMessage({ text: "", type: "" });

    if (!recallBatchId.trim()) {
      setRecallMessage({ text: "Please enter a Phase/Batch ID to recall.", type: "error" });
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

      setRecallMessage({ text: `Batch ${recallBatchId} recalled successfully!`, type: "success" });
      setRecallBatchId("");
      fetchBatches();
    } catch (error: any) {
      setRecallMessage({ text: `Recall failed: ${error.message}`, type: "error" });
    }
  };

  const downloadQR = () => {
    const canvas = document.getElementById("qr-preview-canvas") as HTMLCanvasElement;
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
    { name: "Recalled", value: recalledBatches },
  ];
  const pieColors = ["#10b981", "#ef4444"]; // emerald-500, red-500

  const batchesPerDay: Record<string, number> = {};
  batches.forEach((batch) => {
    if (!batch.created_at) return;
    const date = new Date(batch.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    batchesPerDay[date] = (batchesPerDay[date] || 0) + 1;
  });
  const lineChartData = Object.keys(batchesPerDay).map((date) => ({
    date,
    batches: batchesPerDay[date],
  })).reverse();

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
  const barChartData = Object.keys(medicineCounts).map((name) => ({
    name,
    quantity: medicineCounts[name],
  })).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

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
          daysLeft: diffDays
        });
      }
    });
  });
  expiringMedicines.sort((a, b) => a.daysLeft - b.daysLeft);

  const filteredBatches = batches.filter((batch) =>
    batch.batch_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 text-slate-800">
        <div className="text-xl font-medium animate-pulse">Loading SaaS Dashboard...</div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Overview</h2>
            
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
                <p className="text-sm font-medium text-slate-500 mb-1">Total Batches</p>
                <div className="flex items-end gap-3">
                  <h3 className="text-3xl font-bold text-slate-800">{totalBatches}</h3>
                  <span className="text-sm text-slate-400 mb-1">Registered</span>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
                <p className="text-sm font-medium text-slate-500 mb-1">Active</p>
                <div className="flex items-end gap-3">
                  <h3 className="text-3xl font-bold text-emerald-600">{activeBatches}</h3>
                  <span className="text-sm text-slate-400 mb-1">Currently Valid</span>
                </div>
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col justify-center">
                <p className="text-sm font-medium text-slate-500 mb-1">Recalled</p>
                <div className="flex items-end gap-3">
                  <h3 className="text-3xl font-bold text-red-600">{recalledBatches}</h3>
                  <span className="text-sm text-slate-400 mb-1">Recalled Batches</span>
                </div>
              </div>
            </div>

            {/* Charts 2x2 Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[350px]">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-4">Status Distribution</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {pieChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle"/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[350px]">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-4">Batch Production Over Time</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={lineChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Line type="monotone" dataKey="batches" stroke="#0ea5e9" strokeWidth={2.5} dot={{ stroke: '#0ea5e9', strokeWidth: 2, r: 4, fill: '#fff' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[350px]">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-4">Top Medicines (Volume)</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="quantity" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[350px]">
                <h3 className="text-[15px] font-semibold text-slate-800 mb-4">Expiry Risk Distribution</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={expiryRiskData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={50}>
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
          <div className="max-w-3xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Register New Batch</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              {registerMessage.text && (
                <div className={`mb-6 p-4 rounded-md text-sm font-medium ${registerMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                  {registerMessage.text}
                </div>
              )}

              <form onSubmit={handleRegisterBatch} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Batch ID</label>
                  <input
                    type="text"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    placeholder="e.g. BATCH-2023-A"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-slate-700">Medicines in this Batch</label>
                    <button
                      type="button"
                      onClick={addMedicineEntry}
                      className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg> Add Medicine
                    </button>
                  </div>
                  
                  {medicines.map((medicine, index) => (
                    <div key={index} className="bg-slate-50 p-5 rounded-lg border border-slate-200 relative group transition-all hover:border-blue-300">
                      {medicines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMedicineEntry(index)}
                          className="absolute -top-3 -right-3 bg-white text-slate-400 hover:text-red-500 border border-slate-200 rounded-full p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove medicine"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                        <div className="md:col-span-5">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Medicine Name</label>
                          <input
                            type="text"
                            placeholder="e.g. Paracetamol 500mg"
                            value={medicine.name}
                            onChange={(e) => handleMedicineChange(index, "name", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Quantity</label>
                          <input
                            type="number"
                            placeholder="Amount"
                            min="1"
                            value={medicine.quantity}
                            onChange={(e) => handleMedicineChange(index, "quantity", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="md:col-span-4">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Expiry Date</label>
                          <input
                            type="date"
                            value={medicine.expiryDate}
                            onChange={(e) => handleMedicineChange(index, "expiryDate", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-1 focus:ring-blue-500 outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4">
                  <button
                    type="submit"
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 rounded-lg shadow-sm transition-colors"
                  >
                    Register Batch
                  </button>
                </div>
              </form>

              {qrValue && (
                <div className="mt-8 pt-8 border-t border-slate-200 flex flex-col items-center">
                  <p className="text-sm font-semibold text-slate-800 mb-4">Verification QR Code Generated</p>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 inline-block">
                    <QRCodeCanvas value={qrValue} size={180} fgColor="#0f172a" />
                  </div>
                  <p className="mt-4 text-sm text-slate-500 text-center max-w-sm">
                    This batch is now stored in the network. Navigate to QR Tools to download or evaluate this code.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case "Recall Batch":
        return (
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Recall Batch</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
              {recallMessage.text && (
                <div className={`mb-6 p-4 rounded-md text-sm font-medium ${recallMessage.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-green-50 text-green-800 border border-green-200'}`}>
                  {recallMessage.text}
                </div>
              )}

              <form onSubmit={handleRecallBatch} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Batch ID to Recall</label>
                  <input
                    type="text"
                    value={recallBatchId}
                    onChange={(e) => setRecallBatchId(e.target.value)}
                    placeholder="Enter Batch ID..."
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-shadow"
                  />
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                    <p className="text-xs text-amber-800 leading-relaxed">Warning: This action instantly marks the batch as unsafe across the supply network. It cannot be easily undone.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-3 rounded-lg shadow-sm transition-colors"
                >
                  Confirm Recall
                </button>
              </form>
            </div>
          </div>
        );

      case "Batch History":
        return (
          <div className="max-w-6xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Batch History</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                <div className="relative w-full max-w-md">
                  <input
                    type="text"
                    placeholder="Search by Batch ID..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                  />
                  <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Batch ID</th>
                      <th className="px-6 py-4 font-semibold">Date Created</th>
                      <th className="px-6 py-4 font-semibold">Contents</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredBatches.length > 0 ? (
                      filteredBatches.map((batch) => (
                        <tr key={batch.batch_id} className="hover:bg-slate-50 transition-colors pointer-events-none">
                          <td className="px-6 py-4 font-medium text-slate-900">{batch.batch_id}</td>
                          <td className="px-6 py-4 text-slate-500">
                            {batch.created_at ? new Date(batch.created_at).toLocaleDateString() : 'Unknown'}
                          </td>
                          <td className="px-6 py-4 text-slate-500">
                            {batch.medicines?.length || 0} items registered
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                              batch.status === "Recalled" 
                                ? "bg-red-50 text-red-700 border border-red-200" 
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            }`}>
                              {batch.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-slate-500">
                          No batches found matching your search.
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
          <div className="max-w-6xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">Expiry Alerts</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                <h3 className="text-sm font-medium text-slate-700">Medicines expiring within 30 days</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Batch ID</th>
                      <th className="px-6 py-4 font-semibold">Medicine Name</th>
                      <th className="px-6 py-4 font-semibold">Expiry Date</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {expiringMedicines.length > 0 ? (
                      expiringMedicines.map((med, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors pointer-events-none">
                          <td className="px-6 py-4 font-medium text-slate-900">{med.batch_id}</td>
                          <td className="px-6 py-4 text-slate-700">{med.name}</td>
                          <td className="px-6 py-4 text-slate-500">{new Date(med.expiryDate).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            {med.daysLeft < 0 ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                                🚨 Expired
                              </span>
                            ) : med.daysLeft <= 14 ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-200">
                                ⚠ Critical ({med.daysLeft} days)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                ⚠ Expiring Soon ({med.daysLeft} days)
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="px-6 py-16 text-center text-slate-500">
                          No alerts! All medicines have healthy expiry margins.
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
          <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-slate-800 mb-6">QR Tools</h2>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center flex flex-col items-center">
              <p className="text-slate-600 mb-8 max-w-md">
                Generate and download high-resolution QR codes for batches that have already been registered.
              </p>
              
              <div className="w-full max-w-sm mb-8 text-left">
                <label className="block text-sm font-medium text-slate-700 mb-2">Batch ID</label>
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  placeholder="Enter Batch ID"
                  className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              {batchId ? (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 inline-block mb-6 relative">
                    <QRCodeCanvas 
                      id="qr-preview-canvas"
                      value={`${window.location.origin}/verify/${batchId}`} 
                      size={256} 
                      fgColor="#0f172a" 
                      level="H"
                    />
                  </div>
                  <button
                    onClick={downloadQR}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-medium py-2.5 px-6 rounded-lg shadow-sm transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Download PNG
                  </button>
                </div>
              ) : (
                <div className="py-16 text-slate-400 border-2 border-dashed border-slate-200 w-full rounded-xl">
                  Enter a Batch ID above to preview its QR code
                </div>
              )}
            </div>
          </div>
        );

      default:
        return <div>Select a tab</div>;
    }
  };

  const navItems = [
    { name: "Dashboard", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg> },
    { name: "Register Batch", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { name: "Recall Batch", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg> },
    { name: "Batch History", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
    { name: "Expiry Alerts", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
    { name: "QR Tools", icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg> },
  ];

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 shadow-sm flex flex-col z-20 shrink-0">
        <div className="p-6 border-b border-slate-100 flex items-center justify-center">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mr-3 shadow-sm">
            M
          </div>
          <span className="text-lg font-bold text-slate-800 tracking-tight">PharmaDash</span>
        </div>
        
        <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                activeTab === item.name 
                  ? "bg-slate-100 text-slate-900" 
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <span className={`${activeTab === item.name ? "text-blue-600" : ""}`}>{item.icon}</span>
              {item.name}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Header */}
        <header className="bg-white px-8 py-5 border-b border-slate-200 flex justify-between items-center shrink-0 z-10 sticky top-0 shadow-[0_1px_2px_0_rgba(0,0,0,0.02)]">
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">Manufacturer Dashboard</h1>
          <div className="flex items-center gap-6">
             <span className="text-sm text-slate-500 font-medium">
              Welcome, <span className="text-slate-900">{user?.email}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-sm font-semibold text-slate-500 hover:text-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {renderContent()}
        </main>
      </div>

    </div>
  );
}