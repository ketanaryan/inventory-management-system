// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InventoryChain {
    // Structure to represent a tracked batch
    struct DrugBatch {
        string batchNum;
        string drugName;
        address manufacturer;
        uint256 timestamp;
        string status;
    }

    // Mapping to store batches by a unique string ID (e.g., Supabase ID or QR hash)
    mapping(string => DrugBatch) public batches;
    
    // An array simply to keep track of how many IDs were registered (optional)
    string[] public batchIds;

    // Event emitted when a batch is logged to the blockchain
    event BatchLogged(string indexed id, string batchNum, string drugName, address manufacturer, uint256 timestamp, string status);

    // Function to add a new batch or update its status immutably
    function logBatch(string memory _id, string memory _batchNum, string memory _drugName, string memory _status) public {
        // Here, we just overwrite/update the mapping, but the transaction log (event) is permanent.
        batches[_id] = DrugBatch({
            batchNum: _batchNum,
            drugName: _drugName,
            manufacturer: msg.sender,
            timestamp: block.timestamp,
            status: _status
        });

        batchIds.push(_id);

        emit BatchLogged(_id, _batchNum, _drugName, msg.sender, block.timestamp, _status);
    }

    // Function to retrieve the latest block state for a batch ID
    function getBatch(string memory _id) public view returns (string memory, string memory, address, uint256, string memory) {
        require(bytes(batches[_id].status).length > 0, "Batch does not exist");
        DrugBatch memory batch = batches[_id];
        return (batch.batchNum, batch.drugName, batch.manufacturer, batch.timestamp, batch.status);
    }
}
