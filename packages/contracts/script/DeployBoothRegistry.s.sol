// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/BoothRegistry.sol";

/**
 * @title DeployBoothRegistry
 * @notice Deploys the BoothRegistry contract to Polygon Amoy testnet.
 *
 * Usage:
 *   forge script script/DeployBoothRegistry.s.sol:DeployBoothRegistry \
 *     --rpc-url $RPC_URL \
 *     --broadcast \
 *     --private-key $PRIVATE_KEY
 */
contract DeployBoothRegistry is Script {
    // USDC mock address on Polygon Amoy
    address constant USDC_AMOY = 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582;

    function run() external {
        vm.startBroadcast();

        BoothRegistry registry = new BoothRegistry(USDC_AMOY);

        console.log("BoothRegistry deployed to:", address(registry));

        vm.stopBroadcast();
    }
}
