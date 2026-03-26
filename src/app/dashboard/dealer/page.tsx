"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { User } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { 
  LayoutDashboard, ShoppingCart, 
  AlertTriangle, Clock, LogOut, Activity, Package, CreditCard, Download, CheckCircle, Search, Menu, X
} from "lucide-react";

export default function DealerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState("Request Medicine");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [orders, setOrders] = useState<any[]>([]);
  const [medicineName, setMedicineName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [message, setMessage] = useState({ text: "", type: "" });

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
        fetchOrders(user.id);
      }
    };
    checkUser();
  }, [router]);

  const fetchOrders = async (userIdStr?: string) => {
    setLoading(true);
    const idToUse = userIdStr || user?.id;

    if (!idToUse) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("dealer_orders")
      .select("*")
      .eq("dealer_id", idToUse)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleRequestMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medicineName.trim() || !quantity) return;

    try {
      const { error } = await supabase.from("dealer_orders").insert([{
        dealer_id: user?.id,
        dealer_email: user?.email,
        medicine_name: medicineName,
        requested_quantity: parseInt(quantity),
        status: "Pending"
      }]);

      if (error) throw error;
      
      setMessage({ text: "Request sent successfully!", type: "success" });
      setMedicineName("");
      setQuantity("");
      fetchOrders();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to submit request", type: "error" });
    }
  };

  const handleAction = async (orderId: string, action: string) => {
    let updateData = {};
    if (action === "accept_partial") {
      updateData = { status: "Confirmed By Dealer" };
    } else if (action === "reject_partial") {
      updateData = { status: "Cancelled" };
    } else if (action === "pay") {
      updateData = { status: "Paid" };
    }

    try {
      const { error } = await supabase.from("dealer_orders").update(updateData).eq("id", orderId);
      if (error) throw error;
      fetchOrders();
    } catch (err: any) {
      alert("Error updating order: " + err.message);
    }
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
        <Activity className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  const tabs = [
    { id: "Request Medicine", icon: <ShoppingCart size={20}/>, label: "Request Medicine" },
    { id: "My Orders", icon: <Package size={20}/>, label: "My Orders", count: orders.filter(o => o.status === "Manufacturer Responded").length },
    { id: "Payments", icon: <CreditCard size={20}/>, label: "Payments", count: orders.filter(o => o.status === "Shipped" || o.status === "Delivered").length },
    { id: "Settings", icon: <Download size={20}/>, label: "Install App" },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground font-sans overflow-hidden selection:bg-primary/30">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
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
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-2 text-muted-foreground hover:text-foreground">
             <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-8 space-y-2">
          {tabs.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 relative group overflow-hidden ${
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

        <div className="p-6 border-t border-border bg-card">
          <button onClick={handleLogout} className="flex items-center gap-3 text-muted-foreground hover:text-red-400 w-full transition-colors font-medium text-sm">
            <LogOut size={18}/> Terminate Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col relative z-10 w-full overflow-hidden">
        <header className="px-4 lg:px-10 py-4 lg:py-6 border-b border-border flex justify-between items-center backdrop-blur-md bg-background/50 sticky top-0 shrink-0 z-10">
          <div className="flex items-center gap-3">
             <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground">
               <Menu className="w-6 h-6" />
             </button>
             <div className="w-2 h-2 rounded-full hidden lg:block bg-emerald-500 animate-pulse" />
             <h2 className="hidden lg:block text-sm tracking-wider uppercase font-bold text-foreground opacity-90">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="text-sm text-muted-foreground bg-card border border-border px-4 py-2 rounded-full font-medium">
              Dealer ID: <span className="text-foreground ml-1">{user?.email}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-10 custom-scrollbar w-full">
          
          {/* REQUEST MEDICINE */}
          {activeTab === "Request Medicine" && (
            <div className="max-w-2xl mx-auto animate-fade-in relative z-10">
              <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 text-center flex items-center justify-center gap-3">
                 <Search className="text-primary w-8 h-8" /> Find & Request Stock
              </h2>
              <div className="glass-panel p-10 rounded-3xl border border-border shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
                <p className="text-muted-foreground mb-8 text-left">Send a request to the manufacturer for medicine restock.</p>
                
                {message.text && (
                  <div className={`mb-6 p-4 rounded-xl text-sm font-medium animate-slide-up flex flex-col items-center justify-center border ${
                    message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {message.text}
                  </div>
                )}

                <form onSubmit={handleRequestMedicine} className="space-y-6 relative z-10 text-left">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Medicine Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Paracetamol 500mg"
                      value={medicineName}
                      onChange={(e) => setMedicineName(e.target.value)}
                      className="w-full p-4 bg-card border border-border rounded-xl text-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Quantity Required</label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full p-4 bg-card border border-border rounded-xl text-lg outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-foreground placeholder:text-muted-foreground transition-all"
                    />
                  </div>
                  <button className="w-full bg-primary hover:bg-primary/90 text-foreground py-4 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide font-bold uppercase">
                    Submit Request
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* MY ORDERS */}
          {activeTab === "My Orders" && (
            <div className="glass-panel rounded-2xl border border-border shadow-2xl overflow-hidden animate-fade-in relative z-10">
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
                      <th className="px-8 py-5">Date</th>
                      <th className="px-8 py-5">Medicine</th>
                      <th className="px-8 py-5">Requested Qty</th>
                      <th className="px-8 py-5">Status / Offer</th>
                      <th className="px-8 py-5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {orders.length > 0 ? orders.map((order, i) => (
                      <tr key={i} className="hover:bg-muted transition-colors group">
                        <td className="px-8 py-5 text-sm text-muted-foreground font-medium">{new Date(order.created_at).toLocaleDateString()}</td>
                        <td className="px-8 py-5 font-bold text-foreground capitalize">{order.medicine_name}</td>
                        <td className="px-8 py-5 text-muted-foreground font-medium">{order.requested_quantity} units</td>
                        <td className="px-8 py-5">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider border ${
                            order.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 
                            order.status === 'Manufacturer Responded' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            ['Shipped', 'Delivered', 'Paid', 'Confirmed By Dealer'].includes(order.status) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}>
                            {order.status === 'Manufacturer Responded' ? `Offered: ${order.offered_quantity || 0}` : order.status}
                          </span>
                        </td>
                        <td className="px-8 py-5 text-right">
                          {order.status === "Manufacturer Responded" && (
                            <div className="flex justify-end gap-2">
                              <button onClick={() => handleAction(order.id, 'accept_partial')} className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors">Accept</button>
                              <button onClick={() => handleAction(order.id, 'reject_partial')} className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-colors">Reject</button>
                            </div>
                          )}
                          {order.status === "Pending" && <span className="text-xs text-muted-foreground italic">Awaiting response</span>}
                          {['Confirmed By Dealer', 'Shipped', 'Delivered', 'Paid'].includes(order.status) && <span className="text-xs text-emerald-500 font-bold uppercase"><CheckCircle className="w-4 h-4 inline mr-1" /> Processed</span>}
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={5} className="py-12 text-center text-muted-foreground text-sm uppercase tracking-wider">No active orders found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PAYMENTS */}
          {activeTab === "Payments" && (
            <div className="max-w-4xl mx-auto animate-fade-in relative z-10">
               <h2 className="text-3xl font-bold tracking-tight text-foreground mb-8 flex items-center gap-3">
                 <CreditCard className="w-8 h-8 text-primary" /> Payment Portal
              </h2>
              <div className="grid grid-cols-1 gap-4">
                {orders.filter(o => o.status === "Shipped" || o.status === "Delivered" || o.status === "Paid").length === 0 ? (
                  <div className="glass-panel border border-border p-16 text-center rounded-2xl text-muted-foreground text-sm tracking-wider uppercase">
                     <CheckCircle className="w-8 h-8 mx-auto mb-3 opacity-50 text-emerald-500" /> No pending invoices.
                  </div>
                ) : 
                orders.filter(o => o.status === "Shipped" || o.status === "Delivered" || o.status === "Paid").map((item, i) => (
                    <div key={i} className="p-6 rounded-2xl flex justify-between items-center shadow-lg border border-border bg-card relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-32 h-32 blur-[60px] pointer-events-none rounded-full bg-primary/5" />
                      
                      <div className="flex gap-5 items-center relative z-10">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                           <Package className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-bold text-foreground text-lg capitalize">{item.medicine_name}</h4>
                          <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">Confirmed Dispatched: <span className="text-primary font-bold">{item.offered_quantity} Units</span></p>
                        </div>
                      </div>
                      <div className="text-right relative z-10 flex items-center gap-6">
                        <div className="text-right">
                          <p className={`font-black tracking-wide uppercase text-sm ${item.status === 'Paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                            {item.status}
                          </p>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mt-1">{new Date(item.created_at).toLocaleDateString()}</p>
                        </div>
                        {(item.status === "Shipped" || item.status === "Delivered") && (
                          <button onClick={() => handleAction(item.id, 'pay')} className="bg-primary hover:bg-primary/80 text-foreground py-2.5 px-6 rounded-xl font-bold text-sm shadow-lg transition-all active:scale-[0.98]">
                            Pay Now
                          </button>
                        )}
                      </div>
                    </div>
                ))}
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === "Settings" && (
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
          )}

        </main>
      </div>
    </div>
  );
}
