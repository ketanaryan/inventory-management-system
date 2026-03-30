"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/utils/supabase";
import { User } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { logBatchToBlockchain } from "@/lib/blockchain/inventoryChain";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from "recharts";
import {
  LayoutDashboard, ShoppingCart, AlertTriangle, Clock, LogOut,
  Activity, Package, CreditCard, Download, CheckCircle, Search,
  Menu, X, Zap, RefreshCw, ShieldCheck, TrendingUp, Sparkles, Link
} from "lucide-react";

export default function DealerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [medicineName, setMedicineName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [requestedPrice, setRequestedPrice] = useState("");
  const [manufacturers, setManufacturers] = useState<any[]>([]);
  const [selectedManufacturer, setSelectedManufacturer] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });

  // Blockchain state
  const [isBlockchainSigning, setIsBlockchainSigning] = useState(false);

  // AI Insights State
  const [insights, setInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
        fetchOrders(user.id);
        fetchManufacturers();
      }
    };
    checkUser();

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const paymentStatus = urlParams.get("payment");
      if (paymentStatus === "success") {
        setMessage({ text: "Payment successful! Your order has been marked as Paid.", type: "success" });
        setActiveTab("Payments");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === "cancelled") {
        setMessage({ text: "Payment checkout was cancelled.", type: "error" });
        setActiveTab("Payments");
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (paymentStatus === "error") {
        setMessage({ text: "Payment verification failed. Please try again or contact support.", type: "error" });
        setActiveTab("Payments");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [router]);

  const fetchOrders = async (userIdStr?: string) => {
    setLoading(true);
    const idToUse = userIdStr || user?.id;
    if (!idToUse) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("dealer_orders")
      .select("*")
      .eq("dealer_id", idToUse)
      .order("created_at", { ascending: false });
    if (!error && data) setOrders(data);
    setLoading(false);
  };

  const fetchManufacturers = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const res = await fetch("/api/manufacturers", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setManufacturers(data.manufacturers || []);
      }
    } catch (err) {
      console.error("Failed to fetch manufacturers", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleRequestMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim() || !quantity || !selectedManufacturer) {
      setMessage({ text: "Please fill all required fields including Manufacturer.", type: "error" });
      return;
    }
    try {
      const manufacturerObj = manufacturers.find(m => m.id === selectedManufacturer);
      const { error } = await supabase.from("dealer_orders").insert([{
        dealer_id: user?.id,
        dealer_email: user?.email,
        manufacturer_id: selectedManufacturer,
        manufacturer_email: manufacturerObj?.email || "",
        medicine_name: medicineName,
        requested_quantity: parseInt(quantity),
        requested_price: parseFloat(requestedPrice) || 0,
        status: "Pending"
      }]);
      if (error) throw error;
      setMessage({ text: "Request sent successfully to manufacturer!", type: "success" });
      setMedicineName("");
      setQuantity("");
      setRequestedPrice("");
      fetchOrders();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to submit request", type: "error" });
    }
  };

  const handleAction = async (orderId: string, action: string) => {
    if (action === "pay") {
      try {
        const orderToPay = orders.find((o) => o.id === orderId);
        if (!orderToPay) return;
        const amount = orderToPay.offered_quantity * (orderToPay.offered_price || 10) || 1000;
        const res = await fetch("/api/create-checkout-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, orderId: orderToPay.id, medicineName: orderToPay.medicine_name }),
        });
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
          return;
        } else {
          throw new Error(data.error || "Failed to initiate payment");
        }
      } catch (err: any) {
        alert("Payment Error: " + err.message);
        return;
      }
    }

    let updateData: any = {};
    if (action === "accept_partial") {
      updateData = { status: "Confirmed By Dealer" };
    } else if (action === "reject_partial") {
      updateData = { status: "Cancelled" };
    } else if (action === "mark_delivered") {
      updateData = { status: "Delivered" };
      // Log to blockchain when delivery is confirmed
      const order = orders.find(o => o.id === orderId);
      if (order) {
        try {
          setIsBlockchainSigning(true);
          const txHash = await logBatchToBlockchain(
            `DEALER-ORDER-${orderId}`,
            orderId,
            order.medicine_name,
            "Delivered"
          );
          setIsBlockchainSigning(false);
          setMessage({ text: `Delivery confirmed & signed on blockchain! Hash: ${txHash.slice(0, 20)}...`, type: "success" });
          setActiveTab("My Orders");
        } catch (chainErr) {
          setIsBlockchainSigning(false);
          console.warn("Blockchain signing skipped (Ganache not connected):", chainErr);
        }
      }
    }

    try {
      const { error } = await supabase.from("dealer_orders").update(updateData).eq("id", orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err: any) {
      alert("Error updating order: " + err.message);
    }
  };

  const generateInsights = async () => {
    setLoadingInsights(true);
    setInsights([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const inventoryData = orders.map(o => ({
        medicine_name: o.medicine_name,
        requested_quantity: o.requested_quantity,
        status: o.status,
        created_at: o.created_at,
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

  // Analytics Computations
  const analytics = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(o => o.status === "Pending").length;
    const shipped = orders.filter(o => o.status === "Shipped").length;
    const delivered = orders.filter(o => o.status === "Delivered" || o.status === "Paid").length;
    const cancelled = orders.filter(o => o.status === "Cancelled").length;

    const statusData = [
      { name: "Pending", value: pending, fill: "#eab308" },
      { name: "Shipped", value: shipped, fill: "#3b82f6" },
      { name: "Delivered", value: delivered, fill: "#10b981" },
      { name: "Cancelled", value: cancelled, fill: "#ef4444" },
    ].filter(d => d.value > 0);

    const medicineCounts: Record<string, number> = {};
    orders.forEach(o => {
      if (o.medicine_name) {
        const name = String(o.medicine_name).trim();
        medicineCounts[name] = (medicineCounts[name] || 0) + (parseInt(o.requested_quantity) || 0);
      }
    });
    const medicineData = Object.keys(medicineCounts)
      .map(name => ({ name, quantity: medicineCounts[name] }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 8);

    const byDate: Record<string, number> = {};
    orders.forEach(o => {
      if (!o.created_at) return;
      const d = new Date(o.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      byDate[d] = (byDate[d] || 0) + 1;
    });
    const lineData = Object.keys(byDate)
      .map(date => ({ date, orders: byDate[date] }))
      .reverse()
      .slice(-10);

    const totalSpend = orders
      .filter(o => o.status === "Paid")
      .reduce((acc, o) => acc + ((o.offered_quantity || 0) * (o.offered_price || 0)), 0);

    return { total, pending, shipped, delivered, cancelled, statusData, medicineData, lineData, totalSpend };
  }, [orders]);

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

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Activity className="w-10 h-10 text-primary animate-spin" />
          <div className="text-xl font-medium tracking-tight">Initializing Dealer Dashboard...</div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "Dashboard", icon: <LayoutDashboard size={20} />, label: "Overview" },
    { id: "Request Medicine", icon: <ShoppingCart size={20} />, label: "Request Stock" },
    { id: "My Orders", icon: <Package size={20} />, label: "My Orders", count: orders.filter(o => o.status === "Manufacturer Responded" || o.status === "Shipped").length },
    { id: "Payments", icon: <CreditCard size={20} />, label: "Payments", count: orders.filter(o => o.status === "Delivered").length },
    { id: "Settings", icon: <Download size={20} />, label: "Install App" },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return (
          <div className="space-y-8 animate-fade-in relative z-10 pb-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Dealer Overview</h2>
                <p className="text-muted-foreground mt-1 text-sm md:text-base">Track your procurement pipeline and spend analytics.</p>
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
                    <h3 className="text-lg font-bold text-foreground tracking-tight">AI Procurement Insights</h3>
                    <p className="text-[10px] text-primary font-bold tracking-widest uppercase mt-0.5">Order Analysis</p>
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
                    <span className="text-sm uppercase tracking-wider font-semibold">AI is ready to analyze your procurement data.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Orders", value: analytics.total, color: "text-foreground", icon: <Package className="w-8 h-8 text-foreground/20" /> },
                { label: "Pending", value: analytics.pending, color: "text-amber-400", icon: <Clock className="w-8 h-8 text-amber-500/20" /> },
                { label: "Delivered", value: analytics.delivered, color: "text-emerald-400", icon: <CheckCircle className="w-8 h-8 text-emerald-500/20" /> },
                { label: "Total Spend (INR)", value: `₹${analytics.totalSpend.toLocaleString()}`, color: "text-primary", icon: <TrendingUp className="w-8 h-8 text-primary/20" /> },
              ].map((stat, i) => (
                <div key={i} className="glass-panel p-5 rounded-2xl flex flex-col justify-center relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3">{stat.icon}</div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">{stat.label}</p>
                  <h3 className={`text-2xl md:text-3xl font-bold ${stat.color}`}>{stat.value}</h3>
                </div>
              ))}
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-panel rounded-2xl p-6 flex flex-col h-[380px]">
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">Order Status Distribution</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={analytics.statusData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={5} dataKey="value" stroke="none">
                        {analytics.statusData.map((entry, index) => (
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
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">Orders Over Time</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analytics.lineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="orders" name="Orders" stroke="#8b5cf6" strokeWidth={4} dot={{ stroke: "#8b5cf6", strokeWidth: 2, r: 4, fill: "#09090b" }} activeDot={{ r: 6, fill: "#8b5cf6", strokeWidth: 0 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass-panel rounded-2xl p-6 flex flex-col h-[380px] lg:col-span-2">
                <h3 className="text-[15px] font-semibold text-foreground mb-6 uppercase tracking-wider">Top Requested Medicines (Volume)</h3>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.medicineData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dealerBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={1} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} dy={10} />
                      <YAxis tick={{ fill: "#a1a1aa", fontSize: 11 }} axisLine={false} tickLine={false} dx={-10} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.02)" }} />
                      <Bar dataKey="quantity" name="Quantity" fill="url(#dealerBarGrad)" radius={[6, 6, 0, 0]} maxBarSize={60} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );

      case "Request Medicine":
        return (
          <div className="max-w-2xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 text-center flex items-center justify-center gap-3">
              <Search className="text-primary w-8 h-8" /> Request Stock from Manufacturer
            </h2>
            <div className="glass-panel p-10 rounded-3xl border border-border shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
              <p className="text-muted-foreground mb-8 text-left">Send a procurement request to your manufacturer to check stock availability and initiate an order.</p>
              {message.text && (
                <div className={`mb-6 p-4 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {message.text}
                </div>
              )}
              <form onSubmit={handleRequestMedicine} className="space-y-6 relative z-10 text-left">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Target Manufacturer</label>
                  <select value={selectedManufacturer} onChange={(e) => setSelectedManufacturer(e.target.value)} className="w-full p-4 bg-card border border-border rounded-xl text-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground appearance-none transition-all cursor-pointer">
                    <option value="" disabled className="text-muted-foreground">Select a Manufacturer...</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.id}>{m.name || m.email}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Medicine Name</label>
                  <input type="text" placeholder="e.g. Paracetamol 500mg" value={medicineName} onChange={(e) => setMedicineName(e.target.value)} className="w-full p-4 bg-card border border-border rounded-xl text-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Quantity Required</label>
                  <input type="number" placeholder="e.g. 500" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full p-4 bg-card border border-border rounded-xl text-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Expected Price (Per Unit ₹)</label>
                  <input type="number" placeholder="e.g. 10" value={requestedPrice} onChange={(e) => setRequestedPrice(e.target.value)} className="w-full p-4 bg-card border border-border rounded-xl text-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground transition-all" />
                </div>
                <button className="w-full bg-primary hover:bg-primary/90 text-foreground py-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide font-bold uppercase">
                  Submit Request
                </button>
              </form>
            </div>
          </div>
        );

      case "My Orders":
        return (
          <div className="animate-fade-in relative z-10">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">My Orders</h2>
              {isBlockchainSigning && (
                <div className="flex items-center gap-2 text-amber-400 text-sm font-bold animate-pulse bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-xl">
                  <Link className="w-4 h-4" /> Signing to Blockchain...
                </div>
              )}
            </div>
            {message.text && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {message.type === 'success' ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {message.text}
              </div>
            )}
            <div className="glass-panel rounded-2xl border border-border shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-border bg-white/5 flex justify-between items-center">
                <h3 className="font-bold text-foreground tracking-wide uppercase text-sm">Active Requests & Orders</h3>
                <button onClick={() => fetchOrders()} className="text-xs font-bold text-primary hover:text-primary/80 transition-colors uppercase tracking-wider flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Refresh
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-card text-muted-foreground text-[10px] uppercase font-bold tracking-widest border-b border-border">
                      <th className="px-6 py-5">Date</th>
                      <th className="px-6 py-5">Medicine</th>
                      <th className="px-6 py-5">Requested Qty</th>
                      <th className="px-6 py-5">Status / Offer</th>
                      <th className="px-6 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.length > 0 ? orders.map((order, i) => (
                      <tr key={i} className="hover:bg-muted transition-colors group">
                        <td className="px-6 py-5 text-sm text-muted-foreground font-medium">{new Date(order.created_at).toLocaleDateString()}</td>
                        <td className="px-6 py-5 font-bold text-foreground capitalize">{order.medicine_name}</td>
                        <td className="px-6 py-5">
                          <p className="text-muted-foreground font-medium">{order.requested_quantity} units</p>
                          <p className="text-xs text-primary font-bold mt-1">₹{order.requested_price || 0}/unit</p>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1.5 rounded-full text-[11px] uppercase font-bold tracking-wider border ${
                            order.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                            order.status === 'Manufacturer Responded' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            ['Shipped', 'Delivered', 'Paid', 'Confirmed By Dealer'].includes(order.status) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}>
                            {order.status === 'Manufacturer Responded'
                              ? (order.offered_quantity >= order.requested_quantity
                                ? `Offer: ${order.offered_quantity} @ ₹${order.offered_price || 0}`
                                : `Partial: ${order.offered_quantity || 0} @ ₹${order.offered_price || 0}`)
                              : order.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right">
                          {order.status === "Manufacturer Responded" && (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleAction(order.id, 'accept_partial')} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors">Confirm</button>
                              <button onClick={() => handleAction(order.id, 'reject_partial')} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors">Cancel</button>
                            </div>
                          )}
                          {order.status === "Shipped" && (
                            <button onClick={() => handleAction(order.id, 'mark_delivered')} disabled={isBlockchainSigning} className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors flex items-center gap-2 ml-auto">
                              <ShieldCheck className="w-3 h-3" /> Mark Delivered
                            </button>
                          )}
                          {order.status === "Pending" && <span className="text-xs text-amber-500 font-medium italic animate-pulse">Awaiting Manufacturer...</span>}
                          {['Confirmed By Dealer', 'Delivered', 'Paid'].includes(order.status) && <span className="text-xs text-emerald-500 font-bold uppercase"><CheckCircle className="w-4 h-4 inline mr-1" /> Processed</span>}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-12 text-center text-muted-foreground text-sm uppercase tracking-wider">No active orders found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "Payments":
        return (
          <div className="max-w-4xl mx-auto animate-fade-in relative z-10">
            <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 flex items-center gap-3">
              <CreditCard className="w-8 h-8 text-primary" /> Payment Portal
            </h2>
            {message.text && (
              <div className={`mb-6 p-4 rounded-xl text-sm font-medium animate-slide-up flex items-center gap-3 border ${message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                {message.text}
              </div>
            )}
            <div className="grid grid-cols-1 gap-4">
              {orders.filter(o => o.status === "Delivered" || o.status === "Paid").length === 0 ? (
                <div className="glass-panel border border-border p-16 text-center rounded-2xl text-muted-foreground text-sm tracking-wider uppercase">
                  <CheckCircle className="w-8 h-8 mx-auto mb-3 opacity-50 text-emerald-500" /> No pending invoices. Mark a shipped order as Delivered first.
                </div>
              ) :
                orders.filter(o => o.status === "Delivered" || o.status === "Paid").map((item, i) => (
                  <div key={i} className="p-6 rounded-2xl flex justify-between items-center shadow-lg border border-border bg-card relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] pointer-events-none rounded-full bg-primary/5" />
                    <div className="flex gap-5 items-center relative z-10">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-lg capitalize">{item.medicine_name}</h4>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Dispatched: <span className="text-primary font-bold">{item.offered_quantity} Units</span></p>
                      </div>
                    </div>
                    <div className="text-right relative z-10 flex items-center gap-6">
                      <div className="text-right">
                        <p className={`font-black tracking-wide uppercase text-sm ${item.status === 'Paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {item.status} (₹{(item.offered_quantity * (item.offered_price || 10)).toLocaleString()})
                        </p>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                      </div>
                      {item.status === "Delivered" && (
                        <button onClick={() => handleAction(item.id, 'pay')} className="bg-primary hover:bg-primary/80 text-foreground py-2.5 px-6 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-[0.98]">
                          Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );

      case "Settings":
        return (
          <div className="max-w-2xl mx-auto space-y-8 animate-fade-in relative z-10 text-center py-10">
            <div className="w-20 h-20 bg-primary/20 text-primary mx-auto rounded-full flex items-center justify-center mb-6 border border-primary/30">
              <Download size={40} />
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Install App (.APK / PWA)</h2>
            <p className="text-muted-foreground text-lg mb-8">Install the PharmaVerify platform natively for best performance.</p>
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
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 glass border-r border-border flex flex-col z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 shrink-0`}>
        <div className="p-8 border-b border-border flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-primary rounded-xl flex items-center justify-center text-foreground font-bold mr-4 shadow-lg shadow-indigo-500/20">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight leading-none text-foreground">PharmaDash</h1>
              <span className="text-xs text-indigo-400 font-medium uppercase tracking-wider mt-1 block">Dealer Portal</span>
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
              Dealer: <span className="text-foreground ml-1">{user?.email}</span>
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
