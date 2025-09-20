'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { QRCodeCanvas } from 'qrcode.react';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [batchId, setBatchId] = useState('');
  const [medicines, setMedicines] = useState([
    { name: '', expiryDate: '', quantity: '' }
  ]);
  const [qrValue, setQrValue] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/auth/login');
      } else {
        setUser(user);
        setLoading(false);
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login');
  };

  const handleMedicineChange = (index: number, field: string, value: string) => {
    const newMedicines = [...medicines];
    newMedicines[index] = { ...newMedicines[index], [field]: value };
    setMedicines(newMedicines);
  };

  const addMedicineEntry = () => {
    setMedicines([...medicines, { name: '', expiryDate: '', quantity: '' }]);
  };

  const removeMedicineEntry = (index: number) => {
    const newMedicines = medicines.filter((_, i) => i !== index);
    setMedicines(newMedicines);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    if (!batchId.trim() || medicines.some(med => !med.name || !med.quantity || !med.expiryDate)) {
        setMessage('Error: All fields must be filled.');
        return;
    }

    try {
      const { error } = await supabase
        .from('batches')
        .insert([
          { batch_id: batchId, medicines: medicines }
        ]);

      if (error) {
        throw new Error(error.message);
      }

      const verificationUrl = `${window.location.origin}/verify/${batchId}`;
      setQrValue(verificationUrl);
      setMessage('Batch registered successfully!');

    } catch (error: any) {
        setMessage(`Error: ${error.message}`);
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
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-8">
      {/* Header */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-8 p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-gray-800">Pharma Tracker</h1>
        <div className="flex items-center space-x-4">
          <span className="text-gray-600">Welcome, {user?.email}!</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Registration Form */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Register New Batch</h2>
          {message && (
            <div className={`p-3 rounded-md mb-4 ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {message}
            </div>
          )}
          <form onSubmit={handleRegister}>
            <div className="mb-4">
              <label htmlFor="batchId" className="block text-sm font-medium text-gray-700">Batch ID</label>
              <input
                type="text"
                id="batchId"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-gray-800"
                placeholder="e.g., DRUG-123"
                required
              />
            </div>

            {medicines.map((medicine, index) => (
              <div key={index} className="bg-gray-50 p-4 rounded-md mb-4 relative">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Medicine {index + 1}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input
                      type="text"
                      value={medicine.name}
                      onChange={(e) => handleMedicineChange(index, 'name', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-800"
                      required
                      placeholder="e.g., Paracetamol"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <input
                      type="number"
                      value={medicine.quantity}
                      onChange={(e) => handleMedicineChange(index, 'quantity', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-800"
                      required
                      placeholder="e.g., 100"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
                    <input
                      type="date"
                      value={medicine.expiryDate}
                      onChange={(e) => handleMedicineChange(index, 'expiryDate', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-800"
                      required
                    />
                  </div>
                </div>
                {medicines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMedicineEntry(index)}
                    className="absolute top-2 right-2 p-1 text-red-500 hover:text-red-700"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addMedicineEntry}
              className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded"
            >
              Add Medicine
            </button>

            <button
              type="submit"
              className="w-full mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
            >
              Register on Blockchain
            </button>
          </form>
        </div>

        {/* QR Code and Verification */}
        {qrValue && (
          <div className="bg-white p-6 rounded-lg shadow-md flex flex-col items-center justify-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Verification QR Code</h2>
            <div className="p-4 border border-gray-300 rounded-md">
              <QRCodeCanvas value={qrValue} size={256} />
            </div>
            <p className="mt-4 text-center text-gray-600">
              Scan this QR code to verify the batch.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}