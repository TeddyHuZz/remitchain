// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract YieldVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant USDC_DECIMALS = 6;
    uint256 private constant INDEX_SCALE = 1e18;

    IERC20 public immutable usdc;
    uint256 public apyBps;
    uint256 public accruedIndex;
    uint256 public lastIndexUpdate;

    struct DepositInfo {
        uint256 principal;
        uint256 accruedInterest;
        uint256 userIndex;
    }

    mapping(address => DepositInfo) public deposits;
    uint256 public totalDeposited;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 interest);
    event APYUpdated(uint256 newApyBps);

    constructor(address _usdc, uint256 _apyBps) Ownable(msg.sender) {
        require(_usdc != address(0), "YieldVault: zero address");
        require(_apyBps > 0 && _apyBps <= 5000, "YieldVault: invalid APY");
        usdc = IERC20(_usdc);
        apyBps = _apyBps;
        lastIndexUpdate = block.timestamp;
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "YieldVault: zero amount");
        _updateGlobalIndex();
        _settleInterest(msg.sender);

        deposits[msg.sender].principal += amount;
        totalDeposited += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        _updateGlobalIndex();
        _settleInterest(msg.sender);

        DepositInfo storage info = deposits[msg.sender];
        uint256 totalAvailable = info.principal + info.accruedInterest;

        if (amount == type(uint256).max) {
            amount = totalAvailable;
        }

        require(amount > 0 && amount <= totalAvailable, "YieldVault: insufficient balance");

        uint256 interestPaid;
        if (amount <= info.accruedInterest) {
            info.accruedInterest -= amount;
            interestPaid = amount;
        } else {
            interestPaid = info.accruedInterest;
            uint256 principalDeducted = amount - info.accruedInterest;
            info.accruedInterest = 0;
            info.principal -= principalDeducted;
            totalDeposited -= principalDeducted;
        }

        require(usdc.balanceOf(address(this)) >= amount, "YieldVault: insufficient reserves");
        usdc.safeTransfer(msg.sender, amount);

        emit Withdrawn(msg.sender, amount, interestPaid);
    }

    function balanceOf(address user) external view returns (uint256) {
        DepositInfo memory info = deposits[user];
        if (info.principal == 0 && info.accruedInterest == 0) return 0;
        return info.principal + info.accruedInterest + _calculatePendingInterest(info);
    }

    function principalOf(address user) external view returns (uint256) {
        return deposits[user].principal;
    }

    function interestOf(address user) external view returns (uint256) {
        DepositInfo memory info = deposits[user];
        return info.accruedInterest + _calculatePendingInterest(info);
    }

    function vaultReserves() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    function setAPY(uint256 _apyBps) external onlyOwner {
        require(_apyBps > 0 && _apyBps <= 5000, "YieldVault: invalid APY");
        _updateGlobalIndex();
        apyBps = _apyBps;
        emit APYUpdated(_apyBps);
    }

    function _currentIndex() internal view returns (uint256) {
        if (block.timestamp <= lastIndexUpdate) return accruedIndex;
        uint256 elapsed = block.timestamp - lastIndexUpdate;
        return accruedIndex + (INDEX_SCALE * apyBps * elapsed) / (10000 * SECONDS_PER_YEAR);
    }

    function _updateGlobalIndex() internal {
        accruedIndex = _currentIndex();
        lastIndexUpdate = block.timestamp;
    }

    function _settleInterest(address user) internal {
        DepositInfo storage info = deposits[user];
        if (info.principal > 0) {
            info.accruedInterest += (info.principal * (accruedIndex - info.userIndex)) / INDEX_SCALE;
        }
        info.userIndex = accruedIndex;
    }

    function _calculatePendingInterest(DepositInfo memory info) internal view returns (uint256) {
        if (info.principal == 0) return 0;
        uint256 current = _currentIndex();
        return (info.principal * (current - info.userIndex)) / INDEX_SCALE;
    }
}
