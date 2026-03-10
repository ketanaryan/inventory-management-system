"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";

export default function ConsumerDashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Verification
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
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
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    const data = await res.json();

    return (
      data.address.city ||
      data.address.town ||
      data.address.village ||
      null
    );
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
    navigator.geolocation.getCurrentPosition((position) => {
      setUserLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    });
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

      map = L.map("healthcare-map").setView([19.2183, 72.9781], 11);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      if (userLocation) {
        L.circle([userLocation.latitude, userLocation.longitude], {
          radius: 300,
          color: "blue",
          fillOpacity: 0.2,
        })
          .addTo(map)
          .bindPopup("You are here 📍");
      }

      const customIcon = L.icon({
        iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
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
              <b>${center.name}</b><br/>
              ${center.type}<br/>
              ${center.city}<br/>
              ${distance} km
            `);
        });
    };

    initMap();

    return () => map && map.remove();
  }, [loading, userCity]);

  // ===== Verify =====

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data } = await supabase
      .from("batches")
      .select("*")
      .eq("batch_id", batchId)
      .single();

    if (!data) {
      setMessage("Batch not found — possible counterfeit.");
      return;
    }

    setResult(data);

    const verificationUrl = `${window.location.origin}/verify/${batchId}`;
    setQrValue(verificationUrl);

    if (data.status === "Recalled") {
      setMessage("⚠ Recalled — do not use.");
    } else {
      setMessage("✅ Authentic medicine.");
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-gray-900">

      <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center mb-8 p-4 bg-white border border-slate-200 rounded-xl shadow-xl shadow-black/10">
  <h1 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0">
    Consumer Portal
  </h1>

  <div className="flex items-center space-x-4">
    <span className="text-gray-600">
      {user?.email}
    </span>

    <button
      onClick={() => supabase.auth.signOut()}
      className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
    >
      Logout
    </button>
  </div>
</div>

      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Check Medicine</h2>

        <form onSubmit={handleVerify}>
          <input
            type="text"
            placeholder="Enter batch ID"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />
          <button className="bg-blue-500 text-white px-4 py-2 rounded">
            Verify
          </button>
        </form>

        {message && <p className="mt-4">{message}</p>}

        {qrValue && (
          <div className="mt-6 flex justify-center">
            <QRCodeCanvas value={qrValue} size={200} />
          </div>
        )}
      </div>

      {userCity && (
        <p className="mb-4">
          Showing healthcare facilities near <b>{userCity}</b>
        </p>
      )}

      <div id="healthcare-map" style={{ height: "400px", width: "100%" }} />
    </div>
  );
}