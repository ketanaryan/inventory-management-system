import { ethers } from "ethers";

// The Ganache RPC URL for local development
const GANACHE_RPC_URL = "http://127.0.0.1:7545";

/**
 * Returns a read-only provider.
 * In the browser, it tries to use the window.ethereum provider.
 * Falls back to local Ganache.
 */
export function getReadProvider(): ethers.Provider {
  if (typeof window !== "undefined" && (window as any).ethereum) {
    return new ethers.BrowserProvider((window as any).ethereum);
  }
  return new ethers.JsonRpcProvider(GANACHE_RPC_URL);
}

/**
 * Returns a Signer (write access).
 * In the browser, this will use MetaMask/Browser wallet.
 * Falls back to Ganache provider for local testing only.
 */
export async function getSigner(): Promise<ethers.Signer> {
  // 1. Check for Browser Wallet (MetaMask)
  if (typeof window !== "undefined" && (window as any).ethereum) {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    // Request account access if needed
    await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
    return await provider.getSigner();
  }

  // 2. Fallback to Local Ganache (Node.js or no-wallet browser testing)
  try {
    const provider = new ethers.JsonRpcProvider(GANACHE_RPC_URL);
    const accounts = await provider.listAccounts();
    if (accounts.length > 0) {
      return accounts[0];
    }
  } catch (err) {
    console.warn("Local Ganache not reachable. Please use a browser wallet like MetaMask.");
  }

  throw new Error(
    "No blockchain wallet found. Please install MetaMask or ensure Ganache is running."
  );
}
