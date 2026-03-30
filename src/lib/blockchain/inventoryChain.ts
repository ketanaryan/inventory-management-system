import { ethers } from "ethers";
import { getReadProvider, getSigner } from "./provider";
// This ABI is generated after you run: npx truffle migrate
// It will be auto-populated from src/lib/blockchain/compiled/InventoryChain.json
import InventoryChainArtifact from "./compiled/InventoryChain.json";

// Contract address is set after migration — we read it from the artifact
function getContractAddress(): string {
  const networks = (InventoryChainArtifact as any).networks;
  const networkIds = Object.keys(networks);
  if (networkIds.length === 0) {
    throw new Error(
      "Contract not deployed yet. Please run: npx truffle migrate"
    );
  }
  // Use the last deployed network
  const latestNetworkId = networkIds[networkIds.length - 1];
  return networks[latestNetworkId].address;
}

const ABI = (InventoryChainArtifact as any).abi;

/**
 * Get a read-only contract instance (no wallet needed).
 */
export function getReadContract(): ethers.Contract {
  const provider = getReadProvider();
  const address = getContractAddress();
  return new ethers.Contract(address, ABI, provider);
}

/**
 * Get a write-enabled contract instance (wallet/signer required).
 */
export async function getWriteContract(): Promise<ethers.Contract> {
  const signer = await getSigner();
  const address = getContractAddress();
  return new ethers.Contract(address, ABI, signer);
}

/**
 * Log a drug batch to the blockchain.
 * @param id - Unique batch identifier (e.g., from Supabase)
 * @param batchNum - Batch number string
 * @param drugName - Name of the drug
 * @param status - Current status ("Registered", "Recalled", etc.)
 * @returns Transaction hash as proof of blockchain record
 */
export async function logBatchToBlockchain(
  id: string,
  batchNum: string,
  drugName: string,
  status: string
): Promise<string> {
  const contract = await getWriteContract();
  const tx = await contract.logBatch(id, batchNum, drugName, status);
  await tx.wait(); // Wait for transaction to be mined
  return tx.hash;
}

/**
 * Fetch a batch record from the blockchain.
 * @param id - Unique batch identifier
 */
export async function getBatchFromBlockchain(id: string): Promise<{
  batchNum: string;
  drugName: string;
  manufacturer: string;
  timestamp: number;
  status: string;
} | null> {
  try {
    const contract = getReadContract();
    const result = await contract.getBatch(id);
    return {
      batchNum: result[0],
      drugName: result[1],
      manufacturer: result[2],
      timestamp: Number(result[3]),
      status: result[4],
    };
  } catch (err: any) {
    if (err.message?.includes("Batch does not exist")) return null;
    throw err;
  }
}
