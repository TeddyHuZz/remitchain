// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {YieldVault} from "../src/YieldVault.sol";

contract YieldVaultTest is Test {
    MockUSDC usdc;
    YieldVault vault;
    address user = address(0x5678);

    function setUp() public {
        usdc = new MockUSDC();
        vault = new YieldVault(address(usdc), 500);
        usdc.mint(user, 1_000 * 10 ** 6);
        usdc.mint(address(vault), 500 * 10 ** 6);
        vm.prank(user);
        usdc.approve(address(vault), type(uint256).max);
    }

    function test_AccruesInterestAndWithdrawsMax() public {
        vm.prank(user);
        vault.deposit(1_000 * 10 ** 6);

        vm.warp(block.timestamp + 365 days);
        assertEq(vault.interestOf(user), 50 * 10 ** 6);

        vm.prank(user);
        vault.withdraw(type(uint256).max);
        assertEq(usdc.balanceOf(user), 1_050 * 10 ** 6);
    }
}
