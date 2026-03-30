const InventoryChain = artifacts.require("InventoryChain");

module.exports = function(deployer) {
  deployer.deploy(InventoryChain);
};
