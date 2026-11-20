// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {BoothRegistry} from "../src/BoothRegistry.sol";
import {RemittanceEscrow} from "../src/RemittanceEscrow.sol";

contract RemittanceEscrowTest is Test {
    MockUSDC usdc;
    BoothRegistry registry;
    RemittanceEscrow escrow;
    address sender = address(0x1111);
    address booth = address(0x2222);
    address otherBooth = address(0x3333);

    function setUp() public {
        usdc = new MockUSDC();
        registry = new BoothRegistry(address(usdc));
        escrow = new RemittanceEscrow(address(usdc), address(registry));

        usdc.mint(booth, 100 * 10 ** 6);
        vm.prank(booth);
        usdc.approve(address(registry), type(uint256).max);
        vm.prank(booth);
        registry.applyForBooth("QmBooth", 10 * 10 ** 6);
        registry.reviewBooth(booth, BoothRegistry.Status.Approved);

        usdc.mint(sender, 500 * 10 ** 6);
        vm.prank(sender);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_CreateAndClaimOrder() public {
        bytes32 codeHash = keccak256(abi.encodePacked("REMIT-8821"));
        vm.prank(sender);
        uint256 orderId = escrow.createOrder(booth, 100 * 10 ** 6, codeHash, 1 days);

        vm.prank(booth);
        escrow.claimOrder(orderId, "REMIT-8821");
        assertEq(usdc.balanceOf(booth), 190 * 10 ** 6);
    }

    function test_RefundExpiredOrder() public {
        bytes32 codeHash = keccak256(abi.encodePacked("REMIT-8821"));
        vm.prank(sender);
        uint256 orderId = escrow.createOrder(booth, 100 * 10 ** 6, codeHash, 1 hours);

        vm.warp(block.timestamp + 2 hours);
        vm.prank(sender);
        escrow.refundExpiredOrder(orderId);
        assertEq(usdc.balanceOf(sender), 500 * 10 ** 6);
    }

    function test_RevertWrongPickupCodeOrWrongBooth() public {
        bytes32 codeHash = keccak256(abi.encodePacked("REMIT-8821"));
        vm.prank(sender);
        uint256 orderId = escrow.createOrder(booth, 100 * 10 ** 6, codeHash, 1 days);

        vm.prank(otherBooth);
        vm.expectRevert("Not assigned booth");
        escrow.claimOrder(orderId, "REMIT-8821");

        vm.prank(booth);
        vm.expectRevert("Invalid pickup code");
        escrow.claimOrder(orderId, "WRONG-CODE");
    }

    function test_RevertUnapprovedBoothAndEarlyRefund() public {
        bytes32 codeHash = keccak256(abi.encodePacked("REMIT-8821"));
        vm.prank(sender);
        vm.expectRevert("Booth not approved");
        escrow.createOrder(otherBooth, 100 * 10 ** 6, codeHash, 1 days);

        vm.prank(sender);
        uint256 orderId = escrow.createOrder(booth, 100 * 10 ** 6, codeHash, 1 days);
        vm.prank(sender);
        vm.expectRevert("Order not expired");
        escrow.refundExpiredOrder(orderId);
    }
}
