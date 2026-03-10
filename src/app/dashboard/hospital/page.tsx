"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";

export default function HospitalDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [qrValue, setQrValue] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [alternatives, setAlternatives] = useState<any[]>([]);

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/auth/login");
      } else {
        setUser(user);
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setResult(null);
    setQrValue("");

    try {
      const { data, error } = await supabase
        .from("batches")
        .select("*")
        .eq("batch_id", batchId)
        .single();

      if (error || !data) {
        setMessage("Batch not found — possible counterfeit.");
        return;
      }

      setResult(data);

      const verificationUrl = `${window.location.origin}/verify/${batchId}`;
      setQrValue(verificationUrl);

      if (data.status === "Recalled") {
        setMessage("⚠ Batch is recalled — do not use.");
      } else {
        setMessage("✅ Batch is authentic.");
      }
    } catch {
      setMessage("Error verifying batch.");
    }
  };

  const handleFindAlternatives = (e: React.FormEvent) => {
    e.preventDefault();
    setAlternatives([]);

    const query = searchQuery.toLowerCase();

    if (query.includes("crocin") || query.includes("paracetamol")) {
      setAlternatives([
        { name: "Paracetamol 500 mg tablet", stock: 50 },
        { name: "Panadol 500 mg", stock: 20 },
        { name: "Tylenol 500 mg", stock: 5 },
      ]);
    } else if (query.includes("ibuprofen")) {
      setAlternatives([
        { name: "Motrin 200 mg", stock: 35 },
        { name: "Advil 200 mg", stock: 15 },
      ]);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-gray-900">

      {/* Header */}
      <div className="flex justify-between mb-8">
        <h1 className="text-2xl font-bold">Hospital Dashboard</h1>
        <div>
          <span className="mr-4">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Verify Batch */}
      <div className="bg-white p-6 rounded shadow mb-8">
        <h2 className="text-xl font-bold mb-4">Verify Batch</h2>

        <form onSubmit={handleVerify}>
          <input
            type="text"
            placeholder="Enter scanned batch ID"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />

          <button className="bg-blue-500 text-white px-4 py-2 rounded">
            Fetch Batch
          </button>
        </form>

        {message && <p className="mt-4">{message}</p>}

        {qrValue && (
  <div className="mt-6 flex flex-col items-center">
    <h3 className="font-semibold mb-2">Generated QR</h3>

    <div className="bg-white p-4 rounded-lg shadow">
      <QRCodeCanvas value={qrValue} size={200} />
    </div>

    <p className="text-sm mt-2">Scan to view full details</p>
  </div>
)}

        {result && (
          <div className="mt-6">
            <p><b>Batch ID:</b> {result.batch_id}</p>
            <p><b>Status:</b> {result.status || "Active"}</p>
          </div>
        )}
      </div>

      {/* Alternatives */}
      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Find Alternatives</h2>

        <form onSubmit={handleFindAlternatives}>
          <input
            type="text"
            placeholder="Search medicine"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          />

          <button className="bg-yellow-500 text-white px-4 py-2 rounded">
            Search
          </button>
        </form>

        {alternatives.length > 0 && (
          <ul className="mt-4">
            {alternatives.map((alt, i) => (
              <li key={i}>
                {alt.name} — Stock: {alt.stock}
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
