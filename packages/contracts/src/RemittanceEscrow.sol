// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

interface IBoothRegistry {
    function booths(address vendor)
        external
        view
        returns (string memory ipfsHash, uint256 collateral, uint8 status, uint256 submittedAt);
}

contract RemittanceEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OrderStatus {
        Pending,
        Claimed,
        Refunded
    }

    struct Order {
        address sender;
        address booth;
        uint256 amount;
        bytes32 pickupCodeHash;
        uint256 expiresAt;
        OrderStatus status;
    }

    uint256 public constant PLATFORM_FEE_BPS = 50;

    IERC20 public immutable usdcToken;
    IBoothRegistry public immutable boothRegistry;
    address public immutable treasury;
    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed sender,
        address indexed booth,
        uint256 amount,
        uint256 expiresAt
    );
    event OrderClaimed(uint256 indexed orderId, address indexed booth, uint256 boothPayout, uint256 platformFee);
    event OrderRefunded(uint256 indexed orderId, address indexed sender, uint256 amount);

    constructor(address _usdcToken, address _boothRegistry, address _treasury) {
        require(_usdcToken != address(0) && _boothRegistry != address(0) && _treasury != address(0), "Zero address");
        usdcToken = IERC20(_usdcToken);
        boothRegistry = IBoothRegistry(_boothRegistry);
        treasury = _treasury;
    }

    function createOrder(
        address booth,
        uint256 amount,
        bytes32 pickupCodeHash,
        uint256 ttlSeconds
    ) external nonReentrant returns (uint256 orderId) {
        require(amount > 0, "Zero amount");
        require(pickupCodeHash != bytes32(0), "Invalid code hash");
        require(ttlSeconds >= 1 hours && ttlSeconds <= 30 days, "Invalid TTL");

        (, , uint8 status, uint256 submittedAt) = boothRegistry.booths(booth);
        require(submittedAt > 0 && status == 1, "Booth not approved");

        orderId = nextOrderId++;
        uint256 expiresAt = block.timestamp + ttlSeconds;

        orders[orderId] = Order({
            sender: msg.sender,
            booth: booth,
            amount: amount,
            pickupCodeHash: pickupCodeHash,
            expiresAt: expiresAt,
            status: OrderStatus.Pending
        });

        usdcToken.safeTransferFrom(msg.sender, address(this), amount);
        emit OrderCreated(orderId, msg.sender, booth, amount, expiresAt);
    }

    function claimOrder(uint256 orderId, string calldata pickupCode) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.sender != address(0), "Order not found");
        require(order.status == OrderStatus.Pending, "Order not pending");
        require(msg.sender == order.booth, "Not assigned booth");
        require(block.timestamp <= order.expiresAt, "Order expired");
        require(keccak256(abi.encodePacked(pickupCode)) == order.pickupCodeHash, "Invalid pickup code");

        order.status = OrderStatus.Claimed;
        uint256 platformFee = (order.amount * PLATFORM_FEE_BPS) / 10_000;
        uint256 boothPayout = order.amount - platformFee;
        if (platformFee > 0) {
            usdcToken.safeTransfer(treasury, platformFee);
        }
        usdcToken.safeTransfer(order.booth, boothPayout);
        emit OrderClaimed(orderId, order.booth, boothPayout, platformFee);
    }

    function refundExpiredOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.sender != address(0), "Order not found");
        require(order.status == OrderStatus.Pending, "Order not pending");
        require(msg.sender == order.sender, "Not order sender");
        require(block.timestamp > order.expiresAt, "Order not expired");

        order.status = OrderStatus.Refunded;
        usdcToken.safeTransfer(order.sender, order.amount);
        emit OrderRefunded(orderId, order.sender, order.amount);
    }
}
