"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { QRCodeCanvas } from "qrcode.react";
import { User } from "@supabase/supabase-js";

export default function ManufacturerDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Batch form state
  const [batchId, setBatchId] = useState("");
  const [medicines, setMedicines] = useState([
    { name: "", expiryDate: "", quantity: "" },
  ]);
  const [qrValue, setQrValue] = useState("");
  const [message, setMessage] = useState("");

  // Recall state
  const [recallBatchId, setRecallBatchId] = useState("");
  const [recallMessage, setRecallMessage] = useState("");

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

  const handleMedicineChange = (index: number, field: string, value: string) => {
    const newMedicines = [...medicines];
    newMedicines[index] = { ...newMedicines[index], [field]: value };
    setMedicines(newMedicines);
  };

  const addMedicineEntry = () => {
    setMedicines([...medicines, { name: "", expiryDate: "", quantity: "" }]);
  };

  const removeMedicineEntry = (index: number) => {
    const newMedicines = medicines.filter((_, i) => i !== index);
    setMedicines(newMedicines);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");

    if (
      !batchId.trim() ||
      medicines.some((med) => !med.name || !med.quantity || !med.expiryDate)
    ) {
      setMessage("Error: All fields must be filled.");
      return;
    }

    try {
      const { error } = await supabase
        .from("batches")
        .insert([{ batch_id: batchId, medicines: medicines }]);

      if (error) throw error;

      const verificationUrl = `${window.location.origin}/verify/${batchId}`;
      setQrValue(verificationUrl);
      setMessage("Batch registered successfully!");
    } catch (error: any) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecallMessage("");

    try {
      const { error } = await supabase
        .from("batches")
        .update({ status: "Recalled" })
        .eq("batch_id", recallBatchId);

      if (error) throw error;

      setRecallMessage("Batch recalled successfully!");
    } catch (error: any) {
      setRecallMessage(`Error: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-lg bg-gray-100">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-br from-sky-200 via-blue-300 to-indigo-300 p-4 sm:p-8 text-gray-900">

      {/* Header */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-8 p-4 bg-white border rounded-xl shadow">
        <h1 className="text-2xl font-bold">Manufacturer Dashboard</h1>
        <div className="flex items-center gap-4">
          <span>Welcome, {user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Register Batch */}
        <div className="bg-blue-50 p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold mb-4">Register New Batch</h2>

          {message && (
            <div className="mb-4 p-2 bg-green-100 text-green-700 rounded">
              {message}
            </div>
          )}

          <form onSubmit={handleRegister}>
            <input
              type="text"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="Batch ID"
              className="w-full mb-4 p-2 border rounded"
              required
            />

            {medicines.map((medicine, index) => (
              <div key={index} className="mb-4 p-3 bg-white rounded border">
                <input
                  type="text"
                  placeholder="Medicine Name"
                  value={medicine.name}
                  onChange={(e) =>
                    handleMedicineChange(index, "name", e.target.value)
                  }
                  className="w-full mb-2 p-2 border rounded"
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  value={medicine.quantity}
                  onChange={(e) =>
                    handleMedicineChange(index, "quantity", e.target.value)
                  }
                  className="w-full mb-2 p-2 border rounded"
                />
                <input
                  type="date"
                  value={medicine.expiryDate}
                  onChange={(e) =>
                    handleMedicineChange(index, "expiryDate", e.target.value)
                  }
                  className="w-full p-2 border rounded"
                />

                {medicines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMedicineEntry(index)}
                    className="text-red-500 mt-2"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addMedicineEntry}
              className="mb-4 bg-gray-200 px-3 py-2 rounded"
            >
              Add Medicine
            </button>

            <button className="w-full bg-blue-500 text-white py-2 rounded">
              Register Batch
            </button>
          </form>

         {qrValue && (
            <div className="flex flex-col items-center justify-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Verification QR Code
              </h2>
              <div className="p-4 border border-gray-300 rounded-md">
                <QRCodeCanvas value={qrValue} size={256} />
              </div>
              <p className="mt-4 text-center text-gray-600">
                Scan this QR code to verify the batch.
              </p>
            </div>
          )}
        </div>

        {/* Recall Batch */}
        <div className="bg-red-50 p-6 rounded-xl shadow">
          <h2 className="text-xl font-bold mb-4">Recall Batch</h2>

          <form onSubmit={handleRecall}>
            <input
              type="text"
              value={recallBatchId}
              onChange={(e) => setRecallBatchId(e.target.value)}
              placeholder="Batch ID"
              className="w-full mb-4 p-2 border rounded"
              required
            />

            <button className="w-full bg-red-500 text-white py-2 rounded">
              Recall
            </button>
          </form>

          {recallMessage && (
            <div className="mt-4 p-2 bg-green-100 rounded">
              {recallMessage}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
