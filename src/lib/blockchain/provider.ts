import { ethers } from "ethers";

// The Ganache RPC URL — change port to 8545 if using Ganache CLI
const GANACHE_RPC_URL = "http://127.0.0.1:7545";

/**
 * Returns a read-only JSON-RPC provider pointing at local Ganache.
 * Use this for reading data from the blockchain without a wallet.
 */
export function getReadProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(GANACHE_RPC_URL);
}

/**
 * Returns a Signer (write access).
 * In the browser, this will use MetaMask if available.
 * Falls back to Ganache provider for a simple signing account (testing use only).
 */
export async function getSigner(): Promise<ethers.Signer> {
  // Bypass browser wallet (like Brave Wallet/MetaMask) for local prototyping
  // so it doesn't pop up and block the UI.
  
  const provider = new ethers.JsonRpcProvider(GANACHE_RPC_URL);
  const accounts = await provider.listAccounts();
  if (accounts.length === 0) {
    throw new Error(
      "No accounts found. Please ensure Ganache is running on port 7545."
    );
  }
  return accounts[0];
}
