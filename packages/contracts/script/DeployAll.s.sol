// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {BoothRegistry} from "../src/BoothRegistry.sol";
import {YieldVault} from "../src/YieldVault.sol";
import {RemittanceEscrow} from "../src/RemittanceEscrow.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0));

        vm.startBroadcast(deployerPrivateKey);

        if (usdcAddress == address(0)) {
            MockUSDC mockUsdc = new MockUSDC();
            usdcAddress = address(mockUsdc);
            console.log("MockUSDC deployed:", usdcAddress);
        }

        BoothRegistry registry = new BoothRegistry(usdcAddress);
        YieldVault vault = new YieldVault(usdcAddress, 450);
        RemittanceEscrow escrow = new RemittanceEscrow(usdcAddress, address(registry), vm.addr(deployerPrivateKey));

        console.log("BoothRegistry deployed:", address(registry));
        console.log("YieldVault deployed:", address(vault));
        console.log("RemittanceEscrow deployed:", address(escrow));

        vm.stopBroadcast();
    }
}
