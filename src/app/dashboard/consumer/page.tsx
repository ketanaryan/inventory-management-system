"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { 
  Search, ShieldCheck, ShieldAlert, LogOut, 
  Navigation, Calendar, Package, Info, Bookmark, Trash2, Clock,
  Activity, AlertTriangle, Scan, Flag, Sparkles, X
} from "lucide-react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { getMedicineAlternatives } from "@/app/actions/getMedicineAlternatives";

export default function ConsumerDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"verify" | "history" | "alternatives">("verify");
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  interface AlternativeMedicine { name: string; manufacturer: string; }
  interface AIResult { name: string; genericName?: string; purpose?: string; alternatives?: AlternativeMedicine[]; precautions?: string[]; }

  // AI Alternatives States
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiError, setAiError] = useState("");

  // States
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [verificationHistory, setVerificationHistory] = useState<any[]>([]);
  const [isScanningStatus, setIsScanningStatus] = useState(false);

  // Derived Stats
  const totalScans = verificationHistory.length;
  const safeProducts = verificationHistory.filter(h => h.batches?.status !== "Recalled").length;
  const compromises = totalScans - safeProducts;

  // Helper for expiry
  const getExpiryStatus = (dateString?: string) => {
    if (!dateString) return null;
    const expiryDate = new Date(dateString);
    const now = new Date();
    
    // Reset time for accurate day calculation
    expiryDate.setHours(0,0,0,0);
    now.setHours(0,0,0,0);

    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { status: "expired", label: "EXPIRED", color: "bg-red-500/10 text-red-500 border-red-500/20" };
    if (diffDays <= 30) return { status: "expiring", label: "EXPIRING SOON", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
    return { status: "valid", label: "VALID", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
  };

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

  // ===== 2. MAP SETUP & GEOLOCATION =====
  useEffect(() => {
    if (loading) return;
    let map: any;
    let L: any;
    let mapInstanceLoaded = false;

    const initMap = async (lat: number, lng: number) => {
      if (mapInstanceLoaded) return;
      L = (await import("leaflet")).default;
      
      const container = L.DomUtil.get("healthcare-map");
      if (container) (container as any)._leaflet_id = null;
      
      map = L.map("healthcare-map").setView([lat, lng], 13);
      mapInstanceLoaded = true;
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 20 }).addTo(map);

      // Add User Marker
      const userIcon = L.divIcon({
        className: "custom-div-icon",
        html: `<div style="background-color: #3b82f6; width: 14px; height: 14px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(59,130,246,0.8); animation: pulse 2s infinite;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      L.marker([lat, lng], { icon: userIcon }).addTo(map)
        .bindPopup("<b>You are here</b><br>Fetching nearby hospitals...");

      fetchNearbyHospitals(lat, lng);
    };

    const fetchNearbyHospitals = async (lat: number, lng: number) => {
      try {
        // Query OpenStreetMap via Overpass API for hospitals within ~5km radius
        const query = `
          [out:json];
          (
            node["amenity"="hospital"](around:5000, ${lat}, ${lng});
            way["amenity"="hospital"](around:5000, ${lat}, ${lng});
            relation["amenity"="hospital"](around:5000, ${lat}, ${lng});
          );
          out center;
        `;
        const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
        const response = await fetch(url);
        const data = await response.json();

        // Add hospital markers
        const hospitalIcon = L.divIcon({
          className: "custom-div-icon",
          html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(239,68,68,0.8);"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        if (data.elements && data.elements.length > 0) {
           data.elements.forEach((element: any) => {
             const hLat = element.lat || element.center?.lat;
             const hLon = element.lon || element.center?.lon;
             const name = element.tags?.name || "Unknown Hospital/Clinic";
             
             if (hLat && hLon) {
               L.marker([hLat, hLon], { icon: hospitalIcon }).addTo(map)
                 .bindPopup(`<b>${name}</b><br>Verified Facility`);
             }
           });
        } else {
           L.popup().setLatLng([lat, lng]).setContent("No hospitals found nearby.").openOn(map);
        }

      } catch (err) {
        console.error("Failed to fetch hospitals from OSM:", err);
      }
    };

    // Try HTML5 Geolocation
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          // Success
          initMap(position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.warn("Geolocation denied or failed. Using default location.", error);
          // Fallback to Mumbai
          initMap(19.2183, 72.9781);
        },
        { timeout: 10000 }
      );
    } else {
      // Not supported
      initMap(19.2183, 72.9781);
    }

    return () => { if (map) map.remove(); };
  }, [loading]);

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    
    if (isScannerOpen) {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      
      scanner.render((decodedText) => {
        let cleanId = decodedText.trim();
        try {
          const url = new URL(cleanId);
          const parts = url.pathname.split('/');
          cleanId = parts.pop() || cleanId;
        } catch (err) { }
        
        setBatchId(cleanId);
        setIsScannerOpen(false);
        if(scanner) scanner.clear();
      }, (error) => {
        // silently handle scan errors (it fires constantly when searching for code)
      });
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(console.error);
      }
    };
  }, [isScannerOpen]);

  // ===== 3. HANDLERS =====
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!batchId.trim()) return;

    setResult(null);
    setMessage("Scanning Ledger...");
    setMessageType("");

    // The QR code might contain a full URL (e.g. https://.../verify/BATCH-123)
    // Extract the actual batch ID if it's a URL
    let cleanBatchId = batchId.trim();
    try {
      const url = new URL(cleanBatchId);
      const parts = url.pathname.split('/');
      // take the last part of the path as the batch ID
      cleanBatchId = parts.pop() || cleanBatchId;
    } catch (err) {
      // not a url, use as is
    }

    const { data: batchData, error: fetchError } = await supabase
      .from("batches")
      .select("*")
      .eq("batch_id", cleanBatchId)
      .single();

    if (fetchError || !batchData) {
      setMessage("Counterfeit Detected: Trace not found in ledger.");
      setMessageType("error");
      return;
    }

    // Save scan entry
    const { error: insertError } = await supabase
      .from("user_scans")
      .insert([{ user_id: user?.id, batch_id: cleanBatchId }]);

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

  const handleFindAlternatives = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!aiQuery.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    try {
      const result = await getMedicineAlternatives(aiQuery);
      setAiResult(result);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Failed to find alternatives");
    } finally {
      setAiLoading(false);
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
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 font-bold text-base md:text-lg tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            PharmaVerify Public
          </div>
          <div className="flex items-center gap-6">
            <ThemeToggle />
            <button onClick={handleLogout} className="text-sm text-red-400 flex items-center gap-2 font-medium hover:text-red-300 transition-colors">
              <LogOut size={16} /> Disconnect
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-12 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10">
        
        {/* Left Column: Tools */}
        <div className="lg:col-span-5 space-y-6">

          {/* Quick Stats Banner */}
          <div className="grid grid-cols-3 gap-3 mb-4 animate-fade-in">
            <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center border border-border">
              <Activity className="text-primary mb-2" size={20} />
              <span className="text-2xl font-black">{totalScans}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold text-center mt-1">Total Verified</span>
            </div>
            <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center border border-border">
              <ShieldCheck className="text-emerald-500 mb-2" size={20} />
              <span className="text-2xl font-black text-emerald-500">{safeProducts}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold text-center mt-1">Safe Products</span>
            </div>
            <div className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center border border-border">
              <AlertTriangle className={compromises > 0 ? "text-red-500 mb-2" : "text-muted-foreground mb-2"} size={20} />
              <span className={`text-2xl font-black ${compromises > 0 ? "text-red-500" : "text-muted-foreground"}`}>{compromises}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold text-center mt-1">Alerts</span>
            </div>
          </div>

          <div className="flex gap-2 p-1 bg-card/50 border border-border rounded-2xl">
            <button onClick={() => setActiveTab("verify")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === "verify" ? "bg-primary text-white" : "text-muted-foreground"}`}>Verify Scan</button>
            <button onClick={() => setActiveTab("history")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${activeTab === "history" ? "bg-primary text-white" : "text-muted-foreground"}`}>My Cabinet</button>
            <button onClick={() => setActiveTab("alternatives")} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1 ${activeTab === "alternatives" ? "bg-primary text-white shadow-lg shadow-primary/20" : "text-muted-foreground"}`}>
              <Sparkles size={12} /> AI Guide
            </button>
          </div>

          {activeTab === "verify" && (
            <div className="glass-panel p-8 rounded-3xl border border-border shadow-2xl animate-fade-in">
              <h2 className="text-xl font-bold mb-8 text-center uppercase tracking-tighter italic">Product Handshake</h2>
              
              <div className="flex flex-col sm:flex-row gap-2 mb-4">
                <button 
                  type="button"
                  onClick={() => setIsScannerOpen(true)}
                  className="bg-card border border-border hover:bg-card/80 text-foreground px-4 py-4 rounded-xl flex items-center justify-center transition-all shadow-sm w-full sm:w-auto"
                  title="Scan QR Code"
                >
                  <Scan size={20} className={isScannerOpen ? "animate-pulse text-primary" : "text-muted-foreground"} />
                  <span className="ml-2 sm:hidden font-bold text-xs">SCAN QR</span>
                </button>
                <form onSubmit={handleVerify} className="flex-1 flex gap-2">
                  <input
                    type="text"
                    placeholder="ENTER BATCH IDENTIFIER"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full px-5 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-foreground font-mono text-sm"
                  />
                  <button className="bg-primary px-6 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-primary/20 text-white hover:bg-primary/90 transition-all">
                    Verify
                  </button>
                </form>
              </div>

              {isScannerOpen && (
                <div className="mb-6 bg-card border border-border rounded-xl p-4 relative">
                  <button 
                    onClick={() => setIsScannerOpen(false)}
                    className="absolute top-2 right-2 z-10 bg-background/80 p-1.5 rounded-full hover:bg-background transition-colors"
                  >
                    <X size={16} />
                  </button>
                  <div id="qr-reader" className="w-full rounded-lg overflow-hidden [&_video]:w-full [&_video]:object-cover" />
                </div>
              )}

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
          )}

          {activeTab === "history" && (
            <div className="glass-panel p-6 md:p-8 rounded-3xl border border-border shadow-2xl h-[500px] md:h-[580px] overflow-y-auto">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 italic uppercase tracking-tighter"><Bookmark size={20}/> Secured Cabinet</h2>
              <div className="space-y-3">
                {verificationHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-20 text-xs italic font-medium">Your medicine history is currently empty.</p>
                ) : verificationHistory.map((item, i) => {
                  const medicine = item.batches?.medicines?.[0];
                  const expiryInfo = getExpiryStatus(medicine?.expiryDate || medicine?.expiry_date);
                  
                  return (
                    <div key={i} className="group p-4 bg-card border border-border rounded-2xl hover:border-primary/50 transition-all relative">
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <button 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            alert(`Report filed for Phase-IV monitoring: Batch ${item.batch_id}. Our team will investigate.`); 
                          }} 
                          className="text-muted-foreground hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-all"
                          title="Report Issue"
                        >
                          <Flag size={14} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteScan(item.id); }} 
                          className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="mb-2 pr-12">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-foreground uppercase truncate">
                            {medicine?.name || `Batch ${item.batch_id}`}
                          </p>
                          {expiryInfo && (
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${expiryInfo.color}`}>
                              {expiryInfo.label}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground font-mono mt-1">ID: {item.batch_id}</p>
                      </div>
                      
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-border/50">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded ${item.batches?.status === 'Recalled' ? 'bg-red-500 text-white' : 'bg-emerald-500/20 text-emerald-500'}`}>
                            {item.batches?.status || "ACTIVE"}
                          </span>
                          {medicine && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Package size={10}/> Qty: {medicine.quantity}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Clock size={10} /> {new Date(item.scanned_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "alternatives" && (
            <div className="glass-panel p-6 md:p-8 rounded-3xl border border-border shadow-2xl animate-fade-in min-h-[500px] md:min-h-[580px] flex flex-col">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2 italic uppercase tracking-tighter text-primary">
                <Sparkles size={20}/> AI Medicine Guide
              </h2>
              <p className="text-sm text-muted-foreground mb-6">Search for any medicine to find its purpose, generic name, and safe alternatives.</p>
              
              <form onSubmit={handleFindAlternatives} className="flex gap-2 mb-8">
                <input
                  type="text"
                  placeholder="E.g., Paracetamol, Aspirin..."
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  className="flex-1 px-5 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary outline-none text-foreground text-sm"
                />
                <button disabled={aiLoading} className="bg-primary px-6 rounded-xl font-bold uppercase text-xs tracking-widest shadow-lg shadow-primary/20 text-white hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2">
                  {aiLoading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full"></span> : <Search size={16} />} Search
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
                          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2"><Info size={14} /> Purpose</h4>
                          <p className="text-sm text-foreground/80 leading-relaxed bg-background/50 p-4 rounded-xl border border-border/50">{aiResult.purpose}</p>
                        </div>
                        
                        <div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2"><ShieldAlert size={14} /> Precautions</h4>
                          <ul className="list-disc list-inside text-sm text-foreground/80 space-y-1 bg-background/50 p-4 rounded-xl border border-border/50">
                            {aiResult.precautions?.map((p: string, i: number) => <li key={i}>{p}</li>)}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  {aiResult.alternatives && aiResult.alternatives.length > 0 && (
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-widest text-foreground mb-4 flex items-center gap-2">
                        <Package size={16} className="text-primary" /> Available Alternatives
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {aiResult.alternatives.map((alt, idx: number) => (
                          <div key={idx} className="bg-card border border-border p-4 rounded-xl hover:border-primary/50 transition-all group">
                            <h5 className="font-bold text-foreground text-sm group-hover:text-primary transition-colors">{alt.name}</h5>
                            <p className="text-xs text-muted-foreground mt-1">Mfr: {alt.manufacturer}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Map */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Navigation className="w-5 h-5 md:w-6 md:h-6 text-primary" /> Facility Radar
            </h2>
          </div>
          <div className="glass-panel p-2 rounded-3xl border border-border shadow-2xl relative">
            <div id="healthcare-map" className="w-full h-[400px] md:h-[605px] rounded-2xl bg-[#09090b]" />
          </div>
        </div>
      </div>
    </div>
  );
}