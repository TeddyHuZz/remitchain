// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "lib/forge-std/src/interfaces/IERC20.sol";

/**
 * @title YieldVault
 * @notice A simple on-chain yield vault for USDC deposits.
 *         Calculates yield at a configurable APY rate based on block.timestamp.
 *         Designed for Polygon Amoy testnet; on mainnet, swap to Aave V3 Pool.
 *
 * @dev Yield is computed linearly:
 *      accruedYield = principal * APY_BPS * elapsed / (10000 * SECONDS_PER_YEAR)
 *
 *      The vault must hold enough USDC reserves to pay out accrued interest.
 *      The owner can top up reserves by simply transferring USDC to this contract.
 */
contract YieldVault {
    // ─── Constants ───────────────────────────────────────────────────────
    uint256 public constant SECONDS_PER_YEAR = 365 days; // 31,536,000
    uint256 public constant USDC_DECIMALS = 6;

    // ─── Storage ─────────────────────────────────────────────────────────
    IERC20 public immutable usdc;
    uint256 public apyBps; // APY in basis points (450 = 4.5%)
    address public owner;

    struct DepositInfo {
        uint256 principal;          // User's deposited principal (6 decimals)
        uint256 accruedInterest;    // Interest settled at last update (6 decimals)
        uint256 lastUpdateTimestamp;
    }

    mapping(address => DepositInfo) public deposits;
    uint256 public totalDeposited;

    // ─── Events ──────────────────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 interest);
    event APYUpdated(uint256 newApyBps);

    // ─── Modifiers ───────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "YieldVault: not owner");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _usdc, uint256 _apyBps) {
        require(_usdc != address(0), "YieldVault: zero address");
        require(_apyBps > 0 && _apyBps <= 5000, "YieldVault: invalid APY");
        usdc = IERC20(_usdc);
        apyBps = _apyBps;
        owner = msg.sender;
    }

    // ─── Core Functions ──────────────────────────────────────────────────

    /**
     * @notice Deposit USDC into the yield vault.
     * @param amount Amount of USDC (6 decimals) to deposit.
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "YieldVault: zero amount");

        // Settle any previously accrued interest first
        _settleInterest(msg.sender);

        // Transfer USDC from sender to vault
        require(usdc.transferFrom(msg.sender, address(this), amount), "YieldVault: transfer failed");

        deposits[msg.sender].principal += amount;
        totalDeposited += amount;

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw USDC (principal + accrued interest) from the vault.
     * @param amount Amount of USDC to withdraw. Pass type(uint256).max for full withdrawal.
     */
    function withdraw(uint256 amount) external {
        _settleInterest(msg.sender);

        DepositInfo storage info = deposits[msg.sender];
        uint256 totalAvailable = info.principal + info.accruedInterest;
        
        // Allow max withdrawal
        if (amount == type(uint256).max) {
            amount = totalAvailable;
        }
        
        require(amount > 0 && amount <= totalAvailable, "YieldVault: insufficient balance");

        // Deduct from accrued interest first, then principal
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

        require(usdc.transfer(msg.sender, amount), "YieldVault: transfer failed");

        emit Withdrawn(msg.sender, amount, interestPaid);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /**
     * @notice Returns the total balance (principal + accrued interest) for a user.
     *         This is a view function that computes yield in real-time.
     */
    function balanceOf(address user) external view returns (uint256) {
        DepositInfo memory info = deposits[user];
        if (info.principal == 0 && info.accruedInterest == 0) return 0;

        uint256 pendingInterest = _calculatePendingInterest(info);
        return info.principal + info.accruedInterest + pendingInterest;
    }

    /**
     * @notice Returns the principal (original deposit) for a user.
     */
    function principalOf(address user) external view returns (uint256) {
        return deposits[user].principal;
    }

    /**
     * @notice Returns the total accrued interest (settled + pending) for a user.
     */
    function interestOf(address user) external view returns (uint256) {
        DepositInfo memory info = deposits[user];
        return info.accruedInterest + _calculatePendingInterest(info);
    }

    /**
     * @notice Returns the vault's USDC reserve balance (for interest payouts).
     */
    function vaultReserves() external view returns (uint256) {
        return usdc.balanceOf(address(this));
    }

    // ─── Admin Functions ─────────────────────────────────────────────────

    /**
     * @notice Update the APY rate. Only callable by the owner.
     */
    function setAPY(uint256 _apyBps) external onlyOwner {
        require(_apyBps > 0 && _apyBps <= 5000, "YieldVault: invalid APY");
        apyBps = _apyBps;
        emit APYUpdated(_apyBps);
    }

    // ─── Internal Functions ──────────────────────────────────────────────

    function _settleInterest(address user) internal {
        DepositInfo storage info = deposits[user];
        if (info.principal > 0 && info.lastUpdateTimestamp > 0) {
            uint256 pending = _calculatePendingInterest(info);
            info.accruedInterest += pending;
        }
        info.lastUpdateTimestamp = block.timestamp;
    }

    function _calculatePendingInterest(DepositInfo memory info) internal view returns (uint256) {
        if (info.principal == 0 || info.lastUpdateTimestamp == 0) return 0;
        uint256 elapsed = block.timestamp - info.lastUpdateTimestamp;
        if (elapsed == 0) return 0;
        // interest = principal * apyBps * elapsed / (10000 * SECONDS_PER_YEAR)
        return (info.principal * apyBps * elapsed) / (10000 * SECONDS_PER_YEAR);
    }
}
