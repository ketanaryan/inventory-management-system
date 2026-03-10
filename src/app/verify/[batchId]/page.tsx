"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";

export default function VerifyBatchPage() {
  const [batchId, setBatchId] = useState("");
  const [result, setResult] = useState<any>(null);
  const [message, setMessage] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [alternatives, setAlternatives] = useState<any[]>([]);

  // Automatically take batchId from URL if present
  useEffect(() => {
    const urlParams = window.location.pathname.split('/');
    const id = urlParams[urlParams.length - 1];
    if (id && id !== "[batchID]" && id !== "verify") {
      setBatchId(decodeURIComponent(id));
    }
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setResult(null);

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

      if (data.status === "Recalled") {
        setMessage("⚠ Batch is recalled — do not use.");
      } else {
        setMessage("✅ Batch is authentic.");
      }
    } catch (err) {
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

  return (
    <div className="min-h-screen bg-gray-100 p-8 text-gray-900">

      <div className="flex justify-between mb-8">
        <h1 className="text-2xl font-bold">Verify Medicine Batch</h1>
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
            Verify
          </button>
        </form>

        {message && <p className="mt-4">{message}</p>}

        {result && (
          <div className="mt-4">
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