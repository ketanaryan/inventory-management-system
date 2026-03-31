const { ethers } = require("ethers");
const fs = require("fs");

const SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/EfjLQ-HM89dm_smBJ8snq";

async function run() {
  let log = "";
  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    
    // Check connection
    const network = await provider.getNetwork();
    log += `Connected to network: ${network.name} ${network.chainId}\n`;

    // Read artifact
    const artifactStr = fs.readFileSync("./src/lib/blockchain/compiled/InventoryChain.json", "utf-8");
    const InventoryChainArtifact = JSON.parse(artifactStr);
    
    const networks = InventoryChainArtifact.networks;
    const networkIds = Object.keys(networks);
    const latestNetworkId = networkIds[networkIds.length - 1];
    const contractAddress = networks[latestNetworkId].address;
    log += `Contract Address: ${contractAddress} on network id: ${latestNetworkId}\n`;

    const ABI = InventoryChainArtifact.abi;
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    log += "Fetching batch 999...\n";
    const result = await contract.getBatch("999");
    log += `Batch 999: ${result}\n`;

  } catch (err) {
    log += `Error occurred: ${err.message}\n`;
    log += `Error Code: ${err.code}\n`;
    log += `Error Reason: ${err.reason}\n`;
  }
  fs.writeFileSync('out.txt', log);
}

run();
