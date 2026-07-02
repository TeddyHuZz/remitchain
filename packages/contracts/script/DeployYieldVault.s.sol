// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/YieldVault.sol";

/**
 * @title DeployYieldVault
 * @notice Deploys the YieldVault contract to Polygon Amoy testnet.
 *
 * Usage:
 *   forge script script/DeployYieldVault.s.sol:DeployYieldVault \
 *     --rpc-url https://rpc-amoy.polygon.technology/ \
 *     --broadcast \
 *     --private-key $DEPLOYER_PRIVATE_KEY
 */
contract DeployYieldVault is Script {
    // Circle USDC on Polygon Amoy
    address constant USDC_AMOY = 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582;

    // 4.5% APY = 450 basis points
    uint256 constant APY_BPS = 450;

    function run() external {
        vm.startBroadcast();

        YieldVault vault = new YieldVault(USDC_AMOY, APY_BPS);

        console.log("YieldVault deployed at:", address(vault));
        console.log("USDC address:", USDC_AMOY);
        console.log("APY (bps):", APY_BPS);

        vm.stopBroadcast();
    }
}
