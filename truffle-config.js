require('dotenv').config();
const HDWalletProvider = require('@truffle/hdwallet-provider');

module.exports = {
  // Define where Truffle outputs the compiled smart contracts.
  // We place it in 'src/lib/blockchain/compiled' so Next.js can import the JSON ABIs easily.
  contracts_build_directory: "./src/lib/blockchain/compiled",
  
  networks: {
    // Development network - points to Ganache UI or TestRPC
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 7545,            // Standard Ganache UI port
      network_id: "*",       // Any network (default: none)
    },
    // Ganache CLI might run on 8545
    development_cli: {
      host: "127.0.0.1",
      port: 8545,
      network_id: "*"
    },
    sepolia: {
      provider: () => new HDWalletProvider(
        process.env.PRIVATE_KEY,
        process.env.SEPOLIA_RPC_URL
      ),
      network_id: 11155111,       // Sepolia's id
      gas: 5500000,        // Gas limit used for deploys
      confirmations: 2,    // # of confirmations to wait between deployments. (default: 0)
      timeoutBlocks: 200,  // # of blocks before a deployment times out  (minimum/default: 50)
      skipDryRun: true     // Skip dry run before migrations? (default: false for public nets )
    }
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.19",      // Fetch exact version from solc-bin (default: truffle's version)
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
      }
    }
  }
};
