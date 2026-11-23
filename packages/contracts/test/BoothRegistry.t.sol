// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {BoothRegistry} from "../src/BoothRegistry.sol";

contract BoothRegistryTest is Test {
    MockUSDC usdc;
    BoothRegistry registry;
    address vendor = address(0x1234);

    function setUp() public {
        usdc = new MockUSDC();
        registry = new BoothRegistry(address(usdc));
        usdc.mint(vendor, 100 * 10 ** 6);
        vm.prank(vendor);
        usdc.approve(address(registry), type(uint256).max);
    }

    function test_ApplyReviewAndReapplyAfterRejection() public {
        vm.prank(vendor);
        registry.applyForBooth("QmTest1", 10 * 10 ** 6);

        registry.reviewBooth(vendor, BoothRegistry.Status.Rejected);
        assertEq(usdc.balanceOf(vendor), 100 * 10 ** 6);

        vm.prank(vendor);
        registry.applyForBooth("QmTest2", 15 * 10 ** 6);
        assertEq(registry.getBoothAddresses().length, 1);
    }

    function test_RevertReviewToPending() public {
        vm.prank(vendor);
        registry.applyForBooth("QmTest1", 10 * 10 ** 6);
        vm.expectRevert("Invalid target status");
        registry.reviewBooth(vendor, BoothRegistry.Status.Pending);
    }

    function test_CancelApplicationRefundsCollateral() public {
        vm.prank(vendor);
        registry.applyForBooth("QmTest1", 10 * 10 ** 6);
        vm.prank(vendor);
        registry.cancelApplication();
        assertEq(usdc.balanceOf(vendor), 100 * 10 ** 6);
        assertEq(registry.getBoothAddresses().length, 0);
    }

    function test_RevertInsufficientCollateral() public {
        vm.prank(vendor);
        vm.expectRevert("Insufficient collateral stake");
        registry.applyForBooth("QmTest1", 9 * 10 ** 6);
    }

    function test_RevertDuplicatePendingApplication() public {
        vm.prank(vendor);
        registry.applyForBooth("QmTest1", 10 * 10 ** 6);
        vm.prank(vendor);
        vm.expectRevert("Application already exists");
        registry.applyForBooth("QmTest2", 10 * 10 ** 6);
    }

    function test_RevertNonOwnerReview() public {
        vm.prank(vendor);
        registry.applyForBooth("QmTest1", 10 * 10 ** 6);
        vm.prank(vendor);
        vm.expectRevert();
        registry.reviewBooth(vendor, BoothRegistry.Status.Approved);
    }

    function test_RevokeApprovedBooth() public {
        vm.prank(vendor);
        registry.applyForBooth("QmTest1", 10 * 10 ** 6);
        registry.reviewBooth(vendor, BoothRegistry.Status.Approved);

        registry.revokeBooth(vendor);
        assertEq(usdc.balanceOf(vendor), 100 * 10 ** 6);
        (, , BoothRegistry.Status status, ) = registry.booths(vendor);
        assertEq(uint256(status), uint256(BoothRegistry.Status.Rejected));
    }

    function test_ApprovedBoothExitRequiresCooldown() public {
        vm.prank(vendor);
        registry.applyForBooth("QmTest1", 10 * 10 ** 6);
        registry.reviewBooth(vendor, BoothRegistry.Status.Approved);

        vm.prank(vendor);
        vm.expectRevert("Cooldown active");
        registry.cancelApplication();

        vm.prank(vendor);
        registry.requestExit();

        vm.warp(block.timestamp + 1 days);
        vm.prank(vendor);
        registry.cancelApplication();
        assertEq(usdc.balanceOf(vendor), 100 * 10 ** 6);
        assertEq(registry.getBoothAddresses().length, 0);
    }
}
