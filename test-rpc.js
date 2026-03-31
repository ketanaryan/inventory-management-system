const { ethers } = require("ethers");
const fs = require("fs");

const SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/EfjLQ-HM89dm_smBJ8snq";

async function run() {
  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    
    // Check connection
    const network = await provider.getNetwork();
    console.log("Connected to network:", network.name, network.chainId.toString());

    // Read artifact
    const artifactStr = fs.readFileSync("./src/lib/blockchain/compiled/InventoryChain.json", "utf-8");
    const InventoryChainArtifact = JSON.parse(artifactStr);
    
    const networks = InventoryChainArtifact.networks;
    const networkIds = Object.keys(networks);
    const latestNetworkId = networkIds[networkIds.length - 1];
    const contractAddress = networks[latestNetworkId].address;
    console.log("Contract Address:", contractAddress, "on network id:", latestNetworkId);

    const ABI = InventoryChainArtifact.abi;
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    console.log("Fetching batch 999...");
    const result = await contract.getBatch("999");
    console.log("Batch 999:", result);

  } catch (err) {
    console.error("Error occurred:", err);
  }
}

run();
