'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getBatch } from '@/utils/blockchainService';

// Simplified types for the UI
type Medicine = { name: string; expiryDate: string; quantity: string };
type BatchDetails = {
    batch_id: string;
    medicines: Medicine[];
    status: string;
    created_at: string;
};

const getStatusStyles = (status: string) => {
    switch (status) {
        case 'Authentic':
            return 'bg-green-500 text-white';
        case 'Recalled':
            return 'bg-red-600 text-white';
        case 'Expired':
            return 'bg-yellow-500 text-gray-900';
        case 'Not Found':
            return 'bg-gray-400 text-white';
        default:
            return 'bg-blue-500 text-white';
    }
};

export default function VerifyPage() {
    const params = useParams();
    const batchId = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId;

    const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!batchId) return;

        const fetchBatch = async () => {
            try {
                const data = await getBatch(batchId);
                setBatchDetails(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchBatch();
    }, [batchId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-xl text-gray-600">Verifying batch status...</div>
            </div>
        );
    }

    const statusText = error ? "Not Found" : batchDetails?.status || "Error";

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
            <div className="w-full max-w-xl bg-white p-6 sm:p-8 rounded-lg shadow-2xl border-t-8 border-blue-600">
                <h1 className="text-3xl font-extrabold text-gray-800 mb-6 text-center">Batch Verification</h1>

                <div className={`p-4 rounded-lg text-center font-bold text-xl mb-6 ${getStatusStyles(statusText)}`}>
                    STATUS: {statusText.toUpperCase()}
                </div>

                <h2 className="text-xl font-semibold text-gray-700 mb-4">Batch ID: {batchId}</h2>

                {error ? (
                    <p className="text-red-500">{error}</p>
                ) : (
                    <div>
                        <div className="mb-4 text-sm text-gray-500">
                            Registered on: {new Date(batchDetails?.created_at || '').toLocaleDateString()}
                        </div>

                        <h3 className="text-lg font-bold text-gray-800 mb-2 border-b pb-1">Medicine Details</h3>
                        <ul className="divide-y divide-gray-200">
                            {batchDetails?.medicines?.map((med, index) => (
                                <li key={index} className="py-2">
                                    <p className="font-medium text-gray-900">{med.name}</p>
                                    <p className="text-sm text-gray-600">Quantity: {med.quantity}</p>
                                    <p className="text-sm text-red-500">Expires: {med.expiryDate}</p>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}