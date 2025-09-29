// src/utils/blockchainService.ts (Create this file)
import { supabase } from './supabase';

type BatchData = {
    batch_id: string;
    medicines: { name: string; expiryDate: string; quantity: string }[];
    status: string;
    created_at: string;
};

/**
 * Fetches batch data from Supabase (Mock Blockchain Read).
 * This function is used by the public verification page.
 */
export const getBatch = async (batchId: string): Promise<BatchData> => {
    const { data, error } = await supabase
        .from('batches')
        .select('*')
        .eq('batch_id', batchId)
        .single();

    if (error || !data) {
        // Use a more specific error message for clarity
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
};