"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";
import { 
  LayoutDashboard, CheckCircle, Package, 
  AlertTriangle, Bell, Search, LogOut, Loader2 
} from "lucide-react";

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
  const [alternatives, setAlternatives] = useState<any[]>([]);

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
      setVerifyMessage(data.status === "Recalled" ? "⚠️ RECALLED: Do not use." : "✅ Authentic: Verified.");
    }
  };

  const handleSearchAlternatives = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.toLowerCase();
    // Example Mock Logic: In a real app, you'd query a 'medicines' table
    if (query.includes("paracetamol") || query.includes("dolo")) {
      setAlternatives([
        { name: "Crocin 500mg", stock: 120, location: "Aisle 4" },
        { name: "Tylenol", stock: 15, location: "Aisle 2" }
      ]);
    } else {
      setAlternatives([]);
    }
  };

  if (loading && batches.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
        <p className="text-slate-500 font-medium">Connecting to PharmaChain...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-slate-900 font-sans">
      
      {/* SIDEBAR */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-screen">
        <div className="p-8 flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg text-white font-bold text-xl leading-none">H</div>
          <span className="text-xl font-bold tracking-tight text-slate-800">PharmaDash</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: "Dashboard", icon: <LayoutDashboard size={20}/>, label: "Overview" },
            { id: "Batch Verification", icon: <CheckCircle size={20}/>, label: "Verify Batch" },
            { id: "Medicine Inventory", icon: <Package size={20}/>, label: "Inventory" },
            { id: "Expiry Alerts", icon: <Bell size={20}/>, label: "Expiry Alerts", count: processedData.expiringSoon.length },
            { id: "Recall Alerts", icon: <AlertTriangle size={20}/>, label: "Recall Alerts", count: processedData.recalled.length },
            { id: "Alternatives", icon: <Search size={20}/>, label: "Find Alternatives" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id ? "bg-blue-50 text-blue-600 font-bold" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center gap-3"> {item.icon} {item.label} </div>
              {item.count ? <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{item.count}</span> : null}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-100">
          <button onClick={handleLogout} className="flex items-center gap-3 text-slate-500 hover:text-red-600 px-4 py-3 w-full transition-colors font-medium">
            <LogOut size={20}/> Logout
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-10 border-b border-slate-200 px-8 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">{activeTab}</h2>
          <div className="text-sm text-slate-500 bg-slate-100 px-4 py-2 rounded-full font-medium">
            {user?.email}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          
          {/* 1. OVERVIEW */}
          {activeTab === "Dashboard" && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Inventory Items" value={processedData.inventory.length} color="text-blue-600" />
                <StatCard title="Near Expiry" value={processedData.expiringSoon.length} color="text-amber-500" />
                <StatCard title="Recalled Batches" value={processedData.recalled.length} color="text-red-600" />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold">Live Inventory Stream</h3>
                  <button onClick={fetchBatches} className="text-xs font-bold text-blue-600">REFRESH</button>
                </div>
                <InventoryTable data={processedData.inventory.slice(0, 10)} />
              </div>
            </div>
          )}

          {/* 2. VERIFICATION */}
          {activeTab === "Batch Verification" && (
            <div className="max-w-xl mx-auto bg-white p-10 rounded-3xl border border-slate-200 shadow-xl text-center">
              <h3 className="text-2xl font-bold mb-6">Verify Authenticity</h3>
              <form onSubmit={handleVerify} className="space-y-4">
                <input
                  type="text"
                  placeholder="Enter Batch ID (e.g. 2234)"
                  value={batchIdInput}
                  onChange={(e) => setBatchIdInput(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-center text-lg font-mono outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-black">Run Blockchain Check</button>
              </form>
              {verifyMessage && (
                <div className={`mt-6 p-4 rounded-xl font-bold ${verifyMessage.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {verifyMessage}
                </div>
              )}
              {verificationResult && (
                <div className="mt-8 pt-8 border-t flex flex-col items-center">
                  <QRCodeCanvas value={verificationResult.batch_id} size={150} />
                  <p className="mt-4 font-bold text-slate-800 italic">ID: {verificationResult.batch_id}</p>
                </div>
              )}
            </div>
          )}

          {/* 3. INVENTORY */}
          {activeTab === "Medicine Inventory" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <InventoryTable data={processedData.inventory} />
            </div>
          )}

          {/* 4. EXPIRY ALERTS */}
          {activeTab === "Expiry Alerts" && (
            <div className="grid grid-cols-1 gap-4">
              {processedData.expiringSoon.length === 0 ? <p className="text-slate-400 italic">No items nearing expiry.</p> : 
                processedData.expiringSoon.map((item, i) => <AlertCard key={i} item={item} type="expiry" />)
              }
            </div>
          )}

          {/* 5. RECALL ALERTS */}
          {activeTab === "Recall Alerts" && (
            <div className="grid grid-cols-1 gap-4">
              {processedData.recalled.length === 0 ? <p className="text-slate-400 italic">No recalled items in current stock.</p> : 
                processedData.recalled.map((item, i) => <AlertCard key={i} item={item} type="recall" />)
              }
            </div>
          )}

          {/* 6. ALTERNATIVES */}
          {activeTab === "Alternatives" && (
            <div className="max-w-2xl mx-auto space-y-6">
              <form onSubmit={handleSearchAlternatives} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Search for unavailable medicine..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm"
                />
                <button className="bg-blue-600 text-white px-8 rounded-2xl font-bold">Search</button>
              </form>
              <div className="grid gap-4">
                {alternatives.map((alt, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                    <div>
                      <h4 className="font-bold text-slate-800">{alt.name}</h4>
                      <p className="text-sm text-slate-500">Location: {alt.location}</p>
                    </div>
                    <span className="bg-green-100 text-green-700 px-4 py-1 rounded-full font-bold text-sm">Stock: {alt.stock}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

// --- SHARED COMPONENTS ---

function StatCard({ title, value, color }: any) {
  return (
    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-2">{title}</p>
      <h4 className={`text-4xl font-black ${color}`}>{value}</h4>
    </div>
  );
}

function InventoryTable({ data }: { data: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-widest">
            <th className="px-8 py-4">Medicine Name</th>
            <th className="px-8 py-4">Batch</th>
            <th className="px-8 py-4">Quantity</th>
            <th className="px-8 py-4">Expiry</th>
            <th className="px-8 py-4">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((item, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors">
              <td className="px-8 py-4 font-bold text-slate-700 capitalize">{item.name}</td>
              <td className="px-8 py-4 font-mono text-xs text-slate-400">{item.batch_id}</td>
              <td className="px-8 py-4 text-slate-600 font-medium">{item.quantity}</td>
              <td className="px-8 py-4 text-sm text-slate-500">
                {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : "N/A"}
              </td>
              <td className="px-8 py-4">
                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                  item.status === 'Recalled' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'
                }`}>
                  {item.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AlertCard({ item, type }: { item: any, type: 'expiry' | 'recall' }) {
  return (
    <div className={`p-6 rounded-2xl border-2 flex justify-between items-center ${
      type === 'recall' ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'
    }`}>
      <div className="flex gap-4 items-center">
        {type === 'recall' ? <AlertTriangle className="text-red-600" /> : <Bell className="text-amber-600" />}
        <div>
          <h4 className="font-bold text-slate-900 text-lg capitalize">{item.name}</h4>
          <p className="text-sm text-slate-500">Batch Ref: {item.batch_id}</p>
        </div>
      </div>
      <div className="text-right">
        <p className={`font-black text-xl ${type === 'recall' ? 'text-red-600' : 'text-amber-700'}`}>
          {type === 'recall' ? 'RECALLED' : 'EXPIRING SOON'}
        </p>
        <p className="text-sm font-medium text-slate-600">{new Date(item.expiryDate).toLocaleDateString()}</p>
      </div>
    </div>
  );
}