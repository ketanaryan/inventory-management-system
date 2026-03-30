const ganache = require("ganache");

const server = ganache.server({
  wallet: {
    deterministic: true,
    totalAccounts: 10,
  },
  logging: {
    quiet: false,
  },
});

const PORT = 7545;

server.listen(PORT, async (err) => {
  if (err) {
    console.error("Ganache failed to start:", err);
    process.exit(1);
  }

  const provider = server.provider;
  const accounts = await provider.request({ method: "eth_accounts", params: [] });

  console.log("==========================================");
  console.log(`Ganache started on http://127.0.0.1:${PORT}`);
  console.log("==========================================");
  console.log("Available Accounts:");
  accounts.forEach((acc, i) => {
    console.log(`  (${i}) ${acc}`);
  });
  console.log("==========================================");
  console.log("Press Ctrl+C to stop");
});

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});
