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

    function test_PartialWithdrawDeductsInterestFirst() public {
        vm.prank(user);
        vault.deposit(1_000 * 10 ** 6);

        vm.warp(block.timestamp + 365 days);
        vm.prank(user);
        vault.withdraw(20 * 10 ** 6);

        assertEq(vault.principalOf(user), 1_000 * 10 ** 6);
        assertEq(vault.interestOf(user), 30 * 10 ** 6);
    }

    function test_RevertZeroDepositAndNonOwnerSetAPY() public {
        vm.prank(user);
        vm.expectRevert("YieldVault: zero amount");
        vault.deposit(0);

        vm.prank(user);
        vm.expectRevert();
        vault.setAPY(600);
    }

    function test_RevertWithdrawWhenReservesInsufficient() public {
        YieldVault emptyVault = new YieldVault(address(usdc), 500);
        vm.prank(user);
        usdc.approve(address(emptyVault), type(uint256).max);
        vm.prank(user);
        emptyVault.deposit(1_000 * 10 ** 6);

        vm.warp(block.timestamp + 365 days);
        vm.prank(user);
        vm.expectRevert("YieldVault: insufficient reserves");
        emptyVault.withdraw(type(uint256).max);
    }

    function test_SetAPYDoesNotApplyRetroactively() public {
        vm.prank(user);
        vault.deposit(1_000 * 10 ** 6);

        vm.warp(block.timestamp + 182.5 days);
        vault.setAPY(1000);

        vm.warp(block.timestamp + 182.5 days);
        assertEq(vault.interestOf(user), 75 * 10 ** 6);
    }
}
