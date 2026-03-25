import Dexie, { type EntityTable } from 'dexie';

// Define the Offline Queue Item interface
export interface OfflineScanEvent {
  id?: number; // Auto-increment primary key
  userId: string;
  batchId: string;
  timestamp: string; // ISO String
}

// Initialize Dexie
const db = new Dexie('PharmaVerifyLocalDB') as Dexie & {
  offlineScans: EntityTable<OfflineScanEvent, 'id'>,
};

// Schema declaration
db.version(1).stores({
  offlineScans: '++id, userId, batchId, timestamp', // ++id specifies an auto-incrementing primary key
});

export const saveScanOffline = async (userId: string, batchId: string) => {
  try {
    await db.offlineScans.add({
      userId,
      batchId,
      timestamp: new Date().toISOString()
    });
    console.log("Scan saved offline successfully.");
  } catch (error) {
    console.error("Failed to save offline scan:", error);
  }
};

export const getPendingScans = async () => {
  return await db.offlineScans.toArray();
};

export const clearPendingScans = async () => {
  await db.offlineScans.clear();
};

export default db;
