const { ethers } = require("ethers");
const fs = require("fs");

const SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/EfjLQ-HM89dm_smBJ8snq";

async function run() {
  let log = "";
  try {
    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    
    const artifactStr = fs.readFileSync("./src/lib/blockchain/compiled/InventoryChain.json", "utf-8");
    const InventoryChainArtifact = JSON.parse(artifactStr);
    
    const networks = InventoryChainArtifact.networks;
    let contractAddress;
    if (networks["11155111"]) {
      contractAddress = networks["11155111"].address;
    } else {
      throw new Error("No Sepolia address found!");
    }
    
    log += `Sepolia Contract Address: ${contractAddress}\n`;

    const ABI = InventoryChainArtifact.abi;
    const contract = new ethers.Contract(contractAddress, ABI, provider);

    log += "Fetching batch 999...\n";
    const result = await contract.getBatch("999");
    log += `Batch 999 Name: ${result[1]}, Qty/something: ${result[2]}, Status: ${result[4]}\n`;

  } catch (err) {
    log += `Error occurred: ${err.message}\n`;
    log += `Error Code: ${err.code}\n`;
    log += `Error Reason: ${err.reason}\n`;
  }
  fs.writeFileSync('out3.txt', log);
}

run();
