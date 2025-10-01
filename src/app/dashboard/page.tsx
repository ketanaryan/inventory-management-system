'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import { QRCodeCanvas } from 'qrcode.react';
import { User } from '@supabase/supabase-js';

// --- TYPES ---
type Alternative = {
  name: string;
  stock: number;
  strength: string;
  form: string;
};

type AiResults = {
    generic_alternative: string;
    description: string;
    error?: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [batchId, setBatchId] = useState('');
  const [medicines, setMedicines] = useState([
    { name: '', expiryDate: '', quantity: '' }
  ]);
  const [qrValue, setQrValue] = useState('');
  const [message, setMessage] = useState('');
  
  // Recall/Deactivate state
  const [recallBatchId, setRecallBatchId] = useState('');
  const [recallMessage, setRecallMessage] = useState('');
  
  // Find Alternatives state
  const [searchQuery, setSearchQuery] = useState('');
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [aiResults, setAiResults] = useState<AiResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

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

    } catch (error) { 
        if (error instanceof Error) {
            setMessage(`Error: ${error.message}`);
        } else {
            setMessage('An unknown error occurred.');
        }
    }
  };

  const handleRecall = async (e: React.FormEvent) => {
      e.preventDefault();
      setRecallMessage('');
      try {
          const { error } = await supabase
              .from('batches')
              .update({ status: 'Recalled' })
              .eq('batch_id', recallBatchId);
          if (error) {
              throw new Error(error.message);
          }
          setRecallMessage('Batch recalled successfully!');
      } catch (error) { 
          if (error instanceof Error) {
              setRecallMessage(`Error: ${error.message}`);
          } else {
              setRecallMessage('An unknown error occurred.');
          }
      }
  };

  const handleFindAlternatives = async (e: React.FormEvent) => {
      e.preventDefault();
      setAlternatives([]);
      setAiResults(null);
      setSearchLoading(true);

      try {
          // 1. Call the secure API route
          const apiResponse = await fetch('/api/drug-info', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({ drugName: searchQuery }),
          });

          if (!apiResponse.ok) {
              // Read and report the error message from the API response
              const errorBody = await apiResponse.json();
              throw new Error(errorBody.error || 'AI service failed to provide information.');
          }

          const data: AiResults = await apiResponse.json();
          setAiResults(data);

          if (data.generic_alternative) {
              // 2. Mock alternatives based on the generic name returned by the AI
              const generic = data.generic_alternative;
              setAlternatives([
                  { name: `${generic} 500 mg Tablet`, stock: 45, strength: '500 mg', form: 'Tablet' },
                  { name: `${generic} 250 mg Syrup`, stock: 10, strength: '250 mg', form: 'Syrup - (Warning: Different Form)' },
              ]);
          }

      } catch (error) { // FIX: Using type-safe error handling
          console.error("AI Search Error:", error);
          
          let errorMessage = 'An unknown error occurred during AI search.';
          if (error instanceof Error) {
              errorMessage = error.message;
          }

          setAiResults({ error: errorMessage, generic_alternative: '', description: '' });
      } finally {
          setSearchLoading(false);
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
    <div className="flex flex-col items-center min-h-screen bg-gray-100 p-4 sm:p-8">
      {/* Header */}
      <div className="w-full max-w-5xl flex flex-col sm:flex-row justify-between items-center mb-8 p-4 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2 sm:mb-0">Pharma Tracker</h1>
        <div className="flex items-center space-x-2 sm:space-x-4">
          <span className="text-gray-600 text-sm sm:text-base">Welcome, {user?.email}!</span>
          <button
            onClick={handleLogout}
            className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded text-sm sm:py-2 sm:px-4 sm:text-base"
          >
            Logout
          </button>
        </div>
      </div>
      
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {/* Registration Form */}
        <div className="bg-white p-6 rounded-lg shadow-md col-span-1 md:col-span-2">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Register New Batch</h2>
          {message && (
            <div className={`p-3 rounded-md mb-4 text-sm sm:text-base ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
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

        {/* Action and Utility Section */}
        <div className="bg-white p-6 rounded-lg shadow-md col-span-1 md:col-span-2">
          {/* QR Code */}
          {qrValue && (
            <div className="flex flex-col items-center justify-center mb-8">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">Verification QR Code</h2>
              <div className="p-4 border border-gray-300 rounded-md">
                <QRCodeCanvas value={qrValue} size={256} />
              </div>
              <p className="mt-4 text-center text-gray-600">
                Scan this QR code to verify the batch.
              </p>
            </div>
          )}

          {/* Recall/Deactivate Form */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Recall/Deactivate Batch</h2>
            <form onSubmit={handleRecall}>
              <div className="mb-4">
                <label htmlFor="recallBatchId" className="block text-sm font-medium text-gray-700">Batch ID to Recall</label>
                <input
                  type="text"
                  id="recallBatchId"
                  value={recallBatchId}
                  onChange={(e) => setRecallBatchId(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-800"
                  placeholder="e.g., DRUG-123"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded"
              >
                Set to Recalled
              </button>
              {recallMessage && (
                <div className={`mt-4 p-3 rounded-md text-center ${recallMessage.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                  {recallMessage}
                </div>
              )}
            </form>
          </div>

          {/* Find Alternatives Section */}
          <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Find Alternatives</h2>
            <form onSubmit={handleFindAlternatives}>
              <div className="mb-4">
                <label htmlFor="searchQuery" className="block text-sm font-medium text-gray-700">Search for Drug</label>
                <input
                  type="text"
                  id="searchQuery"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm text-gray-800"
                  placeholder="e.g., Crocin 500 mg"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded"
              >
                Find Alternatives
              </button>
            </form>
            
            {searchLoading && <p className="mt-4 text-center text-blue-500">Fetching data from AI...</p>}
            
            {aiResults && (
                <div className="mt-6 p-4 border border-blue-200 bg-blue-50 rounded-lg">
                    {aiResults.error ? (
                        <p className="text-red-600 font-semibold">{aiResults.error}</p>
                    ) : (
                        <>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">
                                {searchQuery.toUpperCase()}
                            </h3>
                            <p className="text-sm italic text-gray-900 mb-3 border-b pb-2">
                                {aiResults.description}
                            </p>

                            <h4 className="text-md font-semibold text-gray-900 mb-1">
                                Generic Equivalent: <span className="text-green-700">{aiResults.generic_alternative}</span>
                            </h4>
                            
                            {/* Display available alternatives */}
                            {alternatives.length > 0 && (
                                <div className="mt-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Available Alternatives (In-Stock):</h3>
                                    <ul className="divide-y divide-gray-200">
                                        {alternatives.map((alt, index) => (
                                            <li key={index} className="py-2">
                                                <p className='text-gray-900'><strong>{alt.name}</strong></p>
                                                <p className="text-sm text-gray-900">Stock: {alt.stock} | Strength: {alt.strength}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}