"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";
import ThemeToggle from "@/components/ThemeToggle";
import { MapPin, Search, ShieldCheck, ShieldAlert, LogOut, Navigation } from "lucide-react";

export default function ConsumerDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verification
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "">("");
  const [qrValue, setQrValue] = useState("");

  // Map state
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [userCity, setUserCity] = useState<string | null>(null);

  // ===== Map helpers (original logic) =====

  const fetchHealthcareCenters = async () => {
    const { data } = await supabase
      .from("healthcare_centers")
      .select("*");
    return data || [];
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
  };

  const getCityFromCoordinates = async (
    latitude: number,
    longitude: number
  ) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
      );
      const data = await res.json();
      return (
        data.address?.city ||
        data.address?.town ||
        data.address?.village ||
        null
      );
    } catch {
      return null;
    }
  };

  // ===== Auth =====

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) router.push("/auth/login");
      else {
        setUser(user);
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  // ===== Location =====

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      }, () => {
         // silently fail if user blocks location
      });
    }
  }, []);

  useEffect(() => {
    if (!userLocation) return;

    getCityFromCoordinates(
      userLocation.latitude,
      userLocation.longitude
    ).then(setUserCity);
  }, [userLocation]);

  // ===== Leaflet map (original behavior) =====

  useEffect(() => {
    if (loading) return;

    let map: any;

    const initMap = async () => {
      const L = (await import("leaflet")).default;

      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const container = L.DomUtil.get("healthcare-map");
      if (container) (container as any)._leaflet_id = null;

      // Enable dark mode map tiles to match theme
      map = L.map("healthcare-map").setView([19.2183, 72.9781], 11);

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(map);

      if (userLocation) {
        L.circle([userLocation.latitude, userLocation.longitude], {
          radius: 300,
          color: "#8b5cf6",
          fillOpacity: 0.3,
          weight: 2
        })
          .addTo(map)
          .bindPopup("<div style='color:black;'>You are here 📍</div>");
      }

      const customIcon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });

      const centers = await fetchHealthcareCenters();

      centers
        .filter((center: any) =>
          userCity
            ? userCity.toLowerCase().includes(center.city?.toLowerCase())
            : true
        )
        .forEach((center: any) => {
          const distance = userLocation
            ? calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                center.latitude,
                center.longitude
              )
            : "N/A";

          L.marker([center.latitude, center.longitude], { icon: customIcon })
            .addTo(map)
            .bindPopup(`
              <div style='color:black; font-family:sans-serif;'>
                <b style='font-size:14px; color:#1e1b4b;'>${center.name}</b><br/>
                <span style='color:#64748b; font-size:12px;'>${center.type}</span><br/>
                <span style='color:#64748b; font-size:12px;'>${center.city}</span><br/>
                <div style='margin-top:5px; font-weight:bold; color:#8b5cf6;'>${distance} km away</div>
              </div>
            `);
        });
    };

    initMap();

    return () => {
      if (map) map.remove();
    };
  }, [loading, userCity, userLocation]);

  // ===== Verify =====

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setResult(null);
    setQrValue("");
    
    if(!batchId.trim()) {
      setMessage("Please enter a valid batch identifier.");
      setMessageType("error");
      return;
    }

    setMessage("Scanning distributed ledger...");
    setMessageType("");

    const { data } = await supabase
      .from("batches")
      .select("*")
      .eq("batch_id", batchId)
      .single();

    if (!data) {
      setMessage("Counterfeit Detected: Trace not found in ledger.");
      setMessageType("error");
      return;
    }

    setResult(data);
    const verificationUrl = `${window.location.origin}/verify/${batchId}`;
    setQrValue(verificationUrl);

    if (data.status === "Recalled") {
      setMessage("COMPROMISED BATCH - MEDICAL RECALL ACTIVE. DO NOT CONSUME.");
      setMessageType("error");
    } else {
      setMessage("Authentic Product - Origin verified via blockchain trace.");
      setMessageType("success");
    }
  };

  if (loading) return (
     <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
     </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30 relative">
       
      {/* Decorative Background */}
      <div className="absolute top-0 left-0 w-full h-[50vh] bg-gradient-to-b from-primary/10 to-transparent pointer-events-none z-0" />

      {/* Navigation */}
      <nav className="border-b border-border bg-background/50 backdrop-blur-md sticky top-0 z-50">
         <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/20">
                  <ShieldCheck className="w-4 h-4 text-foreground" />
               </div>
               <span className="font-bold text-lg tracking-tight">PharmaVerify Public</span>
            </div>
            <div className="flex items-center gap-6">
               <ThemeToggle />
               <span className="text-sm font-medium text-muted-foreground hidden sm:block">
                  Connected as <span className="text-foreground">{user?.email}</span>
               </span>
               <button onClick={() => supabase.auth.signOut()} className="text-sm text-red-400 hover:text-red-300 transition-colors flex items-center gap-2 font-medium">
                  <LogOut className="w-4 h-4" /> Disconnect
               </button>
            </div>
         </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-12 relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
         
         {/* Left Column: Verification */}
         <div className="lg:col-span-5 space-y-8">
            <div className="glass-panel p-8 rounded-3xl border border-border shadow-2xl relative overflow-hidden animate-fade-in text-center">
               <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 rounded-full blur-[80px] pointer-events-none" />
               
               <h2 className="text-2xl font-bold tracking-tight mb-2 relative z-10 text-foreground">Authenticate Product</h2>
               <p className="text-sm text-muted-foreground mb-8 relative z-10">Enter the cryptographic hash or batch number found on the physical packaging to verify its origin.</p>

               <form onSubmit={handleVerify} className="relative z-10 w-full mb-8">
                 <div className="relative mb-4">
                    <input
                      type="text"
                      placeholder="e.g. BATCH-2026-NEXUS"
                      value={batchId}
                      onChange={(e) => setBatchId(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-card border border-border rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all text-foreground placeholder:text-muted-foreground uppercase tracking-widest font-mono text-sm"
                    />
                    <Search className="w-5 h-5 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                 </div>
                 <button className="w-full bg-primary hover:bg-primary/90 text-foreground font-medium py-3.5 rounded-xl shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all active:scale-[0.98] tracking-wide relative overflow-hidden group">
                    <span className="relative z-10">Execute Ledger Scan</span>
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                 </button>
               </form>

               {message && (
                  <div className={`p-4 rounded-xl text-sm font-medium my-6 flex items-start gap-3 border animate-slide-up ${
                     messageType === "success" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-left" : 
                     messageType === "error" ? "bg-red-500/10 text-red-400 border-red-500/20 text-left" : "bg-white/5 text-muted-foreground text-center line-pulse"
                  }`}>
                     {messageType === "success" && <ShieldCheck className="w-5 h-5 shrink-0 mt-0.5" />}
                     {messageType === "error" && <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />}
                     <span className="leading-relaxed">{message}</span>
                  </div>
               )}

               {qrValue && result && (
                  <div className="pt-6 border-t border-border animate-scale-in">
                     <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Cryptographic Identity</p>
                     <div className="inline-block p-4 bg-white rounded-2xl shadow-[0_0_40px_rgba(139,92,246,0.15)]">
                        <QRCodeCanvas value={qrValue} size={160} fgColor="#09090b" />
                     </div>
                  </div>
               )}
            </div>
         </div>

         {/* Right Column: Radar Map */}
         <div className="lg:col-span-7 space-y-4 animate-fade-in" style={{ animationDelay: "100ms" }}>
            <div className="flex items-end justify-between px-2">
               <div>
                  <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-3">
                     <Navigation className="w-6 h-6 text-primary" />
                     Facility Radar
                  </h2>
                  {userCity && <p className="text-sm text-primary mt-1 font-medium tracking-wide">Scanning sector: {userCity.toUpperCase()}</p>}
               </div>
            </div>
            
            <div className="glass-panel p-2 rounded-3xl border border-border shadow-2xl overflow-hidden relative group">
               <div className="absolute inset-0 border-2 border-primary/20 rounded-3xl z-20 pointer-events-none group-hover:border-primary/40 transition-colors" />
               <div id="healthcare-map" className="w-full h-[550px] rounded-2xl z-10 bg-[#09090b]" />
               
               {/* Map overlay elements */}
               <div className="absolute bottom-6 right-6 z-[400] bg-black/60 backdrop-blur-md border border-border px-4 py-2 rounded-xl text-xs font-medium text-foreground flex items-center gap-2 shadow-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Live Tracking Active
               </div>
            </div>
         </div>

      </div>
    </div>
  );
}