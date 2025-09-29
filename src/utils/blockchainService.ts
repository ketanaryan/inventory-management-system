// src/utils/blockchainService.ts

import { supabase } from './supabase';

type BatchData = {
    batch_id: string;
    medicines: { name: string; expiryDate: string; quantity: string }[];
    status: string;
    created_at: string;
};

export const getBatch = async (batchId: string): Promise<BatchData> => {
    try {
        const { data, error } = await supabase
            .from('batches')
            .select('*')
            .eq('batch_id', batchId)
            .single();

        if (error || !data) {
            throw new Error(`Batch verification failed. Error: ${error?.message || 'Data not found.'}`);
        }

        // Custom status check (Expiration Logic)
        let currentStatus = data.status;
        const now = new Date();
        
        // Check if any medicine has expired
        const isExpired = data.medicines.some((med: any) => {
            const expiryDate = new Date(med.expiryDate);
            return expiryDate < now;
        });

        if (isExpired) {
            currentStatus = "Expired";
        }

        return { ...data, status: currentStatus } as BatchData;
    } catch (error) { // Line 29: FIX APPLIED HERE
        if (error instanceof Error) {
            throw error;
        }
        // If the error is not a standard Error object, throw a generic one
        throw new Error('An unexpected error occurred during database access.');
    }
};