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
