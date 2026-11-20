# RemitChain Hardening, MockUSDC, & Off-Ramp Escrow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn RemitChain from a Polygon Amoy prototype into a secure, tested, end-to-end remittance and merchant off-ramp application with an on-chain escrow claim flow, optional `MockUSDC` for frictionless testing, shared contract SDK, and hardened web/mobile runtimes.

**Architecture:** We add `MockUSDC` and `RemittanceEscrow` alongside hardened `BoothRegistry` and `YieldVault` contracts in `packages/contracts`, expose their ABIs and addresses via a new `@repo/contracts-sdk` workspace package, then wire both `apps/web` and `apps/mobile` to use real on-chain escrow claims, `multicall` batching, and authenticated endpoints.

**Tech Stack:** Solidity `^0.8.20` (Foundry, OpenZeppelin), TypeScript, `viem`, Next.js 16 (`apps/web`), Expo 57 / React Native 0.86 (`apps/mobile`), ZeroDev Kernel v3.1, pnpm + Turborepo.

## Global Constraints

- Target chain: Polygon Amoy (`chainId: 80002`).
- Token precision: 6 decimals for USDC / `MockUSDC`.
- Zero comments in generated or edited code (encode constraints in types, runtime checks, or tests).
- Never hardcode admin passcodes or bypass wallet signature verification on privileged actions.
- All contract changes must have passing `forge test` unit/fuzz tests before moving to frontend/mobile tasks.

---

### Task 1: Harden Contracts, Add `MockUSDC` & `RemittanceEscrow`, and Write Foundry Tests

**Files:**
- Delete: `packages/contracts/src/Counter.sol`, `packages/contracts/script/Counter.s.sol`, `packages/contracts/test/Counter.t.sol`
- Create: `packages/contracts/src/MockUSDC.sol`
- Create: `packages/contracts/src/RemittanceEscrow.sol`
- Modify: `packages/contracts/src/BoothRegistry.sol`
- Modify: `packages/contracts/src/YieldVault.sol`
- Create: `packages/contracts/test/BoothRegistry.t.sol`
- Create: `packages/contracts/test/YieldVault.t.sol`
- Create: `packages/contracts/test/RemittanceEscrow.t.sol`
- Create: `packages/contracts/script/DeployAll.s.sol`

**Interfaces:**
- Produces:
  - `MockUSDC`: `mint(address to, uint256 amount)`, `faucet()` (mints 1,000 USDC to `msg.sender`), `decimals() returns (uint8)` (`6`).
  - `BoothRegistry`: `applyForBooth(string _ipfsHash, uint256 _collateralAmount)`, `reviewBooth(address _vendor, Status _status)`, `cancelApplication()`, `getBoothAddresses() returns (address[])`, `booths(address) returns (string, uint256, Status, uint256)`.
  - `YieldVault`: `deposit(uint256 amount)`, `withdraw(uint256 amount)`, `setAPY(uint256 _apyBps)`, `transferOwnership(address newOwner)`, `balanceOf(address) returns (uint256)`, `principalOf(address) returns (uint256)`, `interestOf(address) returns (uint256)`.
  - `RemittanceEscrow`: `createOrder(address booth, uint256 amount, bytes32 pickupCodeHash, uint256 ttlSeconds) returns (uint256 orderId)`, `claimOrder(uint256 orderId, string pickupCode)`, `refundExpiredOrder(uint256 orderId)`, `orders(uint256) returns (address sender, address booth, uint256 amount, bytes32 pickupCodeHash, uint256 expiresAt, uint8 status)`.

- [ ] **Step 1: Remove template `Counter` files and create `MockUSDC.sol`**

```bash
rm -f packages/contracts/src/Counter.sol packages/contracts/script/Counter.s.sol packages/contracts/test/Counter.t.sol
```

Create `packages/contracts/src/MockUSDC.sol`:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 1_000 * 10 ** 6;

    constructor() ERC20("Mock USD Coin", "USDC") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
```

- [ ] **Step 2: Harden `BoothRegistry.sol`**

Update `packages/contracts/src/BoothRegistry.sol` to use `SafeERC20`, `ReentrancyGuard`, zero-address check, `Status.Pending` guard in `reviewBooth`, `ApplicationCancelled` event, and allow `Rejected` applications to be cleared/re-applied:
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

contract BoothRegistry is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdcToken;
    uint256 public constant MINIMUM_COLLATERAL = 10 * 10 ** 6;

    enum Status {
        Pending,
        Approved,
        Rejected
    }

    struct Booth {
        string ipfsHash;
        uint256 collateral;
        Status status;
        uint256 submittedAt;
    }

    mapping(address => Booth) public booths;
    address[] public boothAddresses;

    event BoothApplied(address indexed vendor, string ipfsHash, uint256 collateral);
    event BoothReviewed(address indexed vendor, Status status);
    event ApplicationCancelled(address indexed vendor, uint256 refundedCollateral);

    constructor(address _usdcToken) Ownable(msg.sender) {
        require(_usdcToken != address(0), "Zero USDC address");
        usdcToken = IERC20(_usdcToken);
    }

    function applyForBooth(string calldata _ipfsHash, uint256 _collateralAmount) external nonReentrant {
        require(bytes(_ipfsHash).length > 0, "Empty IPFS hash");
        require(_collateralAmount >= MINIMUM_COLLATERAL, "Insufficient collateral stake");
        require(
            booths[msg.sender].submittedAt == 0 || booths[msg.sender].status == Status.Rejected,
            "Application already exists"
        );

        bool isNewAddress = booths[msg.sender].submittedAt == 0;

        booths[msg.sender] = Booth({
            ipfsHash: _ipfsHash,
            collateral: _collateralAmount,
            status: Status.Pending,
            submittedAt: block.timestamp
        });

        if (isNewAddress) {
            boothAddresses.push(msg.sender);
        }

        usdcToken.safeTransferFrom(msg.sender, address(this), _collateralAmount);
        emit BoothApplied(msg.sender, _ipfsHash, _collateralAmount);
    }

    function reviewBooth(address _vendor, Status _status) external onlyOwner nonReentrant {
        require(_status != Status.Pending, "Invalid target status");
        Booth storage booth = booths[_vendor];
        require(booth.submittedAt > 0, "Booth application not found");
        require(booth.status == Status.Pending, "Application already reviewed");

        booth.status = _status;

        if (_status == Status.Rejected) {
            uint256 refundAmount = booth.collateral;
            booth.collateral = 0;
            usdcToken.safeTransfer(_vendor, refundAmount);
        }

        emit BoothReviewed(_vendor, _status);
    }

    function cancelApplication() external nonReentrant {
        Booth storage booth = booths[msg.sender];
        require(booth.submittedAt > 0, "Application not found");
        require(
            booth.status == Status.Pending || booth.status == Status.Approved,
            "Cannot cancel this application"
        );

        uint256 refundAmount = booth.collateral;
        delete booths[msg.sender];

        for (uint256 i = 0; i < boothAddresses.length; i++) {
            if (boothAddresses[i] == msg.sender) {
                boothAddresses[i] = boothAddresses[boothAddresses.length - 1];
                boothAddresses.pop();
                break;
            }
        }

        usdcToken.safeTransfer(msg.sender, refundAmount);
        emit ApplicationCancelled(msg.sender, refundAmount);
    }

    function getBoothAddresses() external view returns (address[] memory) {
        return boothAddresses;
    }
}
```

- [ ] **Step 3: Harden `YieldVault.sol`**

Update `packages/contracts/src/YieldVault.sol` to use OpenZeppelin `IERC20`, `SafeERC20`, `Ownable`, `ReentrancyGuard`, and check reserve solvency on withdrawal:
```solidity
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

    IERC20 public immutable usdc;
    uint256 public apyBps;

    struct DepositInfo {
        uint256 principal;
        uint256 accruedInterest;
        uint256 lastUpdateTimestamp;
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
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "YieldVault: zero amount");
        _settleInterest(msg.sender);

        deposits[msg.sender].principal += amount;
        totalDeposited += amount;

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
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
        apyBps = _apyBps;
        emit APYUpdated(_apyBps);
    }

    function _settleInterest(address user) internal {
        DepositInfo storage info = deposits[user];
        if (info.lastUpdateTimestamp > 0 && info.principal > 0) {
            info.accruedInterest += _calculatePendingInterest(info);
        }
        info.lastUpdateTimestamp = block.timestamp;
    }

    function _calculatePendingInterest(DepositInfo memory info) internal view returns (uint256) {
        if (info.lastUpdateTimestamp == 0 || info.principal == 0) return 0;
        uint256 elapsed = block.timestamp - info.lastUpdateTimestamp;
        return (info.principal * apyBps * elapsed) / (10000 * SECONDS_PER_YEAR);
    }
}
```

- [ ] **Step 4: Create `RemittanceEscrow.sol`**

Create `packages/contracts/src/RemittanceEscrow.sol`:
```solidity
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

    IERC20 public immutable usdcToken;
    IBoothRegistry public immutable boothRegistry;
    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed sender,
        address indexed booth,
        uint256 amount,
        uint256 expiresAt
    );
    event OrderClaimed(uint256 indexed orderId, address indexed booth, uint256 amount);
    event OrderRefunded(uint256 indexed orderId, address indexed sender, uint256 amount);

    constructor(address _usdcToken, address _boothRegistry) {
        require(_usdcToken != address(0) && _boothRegistry != address(0), "Zero address");
        usdcToken = IERC20(_usdcToken);
        boothRegistry = IBoothRegistry(_boothRegistry);
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
        usdcToken.safeTransfer(order.booth, order.amount);
        emit OrderClaimed(orderId, order.booth, order.amount);
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
```

- [ ] **Step 5: Write Foundry tests for `BoothRegistry`, `YieldVault`, and `RemittanceEscrow`**

Create `packages/contracts/test/BoothRegistry.t.sol`:
```solidity
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
}
```

Create `packages/contracts/test/YieldVault.t.sol`:
```solidity
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
```

Create `packages/contracts/test/RemittanceEscrow.t.sol`:
```solidity
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
}
```

- [ ] **Step 6: Run Foundry tests and create `DeployAll.s.sol`**

Run: `cd packages/contracts && forge test -vvv`
Expected: PASS on all tests in `BoothRegistryTest`, `YieldVaultTest`, and `RemittanceEscrowTest`.

Create `packages/contracts/script/DeployAll.s.sol`:
```solidity
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
        RemittanceEscrow escrow = new RemittanceEscrow(usdcAddress, address(registry));

        console.log("BoothRegistry deployed:", address(registry));
        console.log("YieldVault deployed:", address(vault));
        console.log("RemittanceEscrow deployed:", address(escrow));

        vm.stopBroadcast();
    }
}
```

- [ ] **Step 7: Commit contracts**

```bash
git add packages/contracts
git commit -m "feat(contracts): add MockUSDC, RemittanceEscrow, harden registry/vault, and add tests"
```

---

### Task 2: Create Shared `@repo/contracts-sdk` Package

**Files:**
- Create: `packages/contracts-sdk/package.json`
- Create: `packages/contracts-sdk/tsconfig.json`
- Create: `packages/contracts-sdk/src/index.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/mobile/package.json`

**Interfaces:**
- Produces: `@repo/contracts-sdk` exporting `AMOY_CHAIN_ID`, `AMOY_PUBLIC_RPC`, `ERC20_ABI`, `BOOTH_REGISTRY_ABI`, `YIELD_VAULT_ABI`, `REMITTANCE_ESCROW_ABI`, and `BoothMetadata` type.

- [ ] **Step 1: Create `packages/contracts-sdk` files**

Create `packages/contracts-sdk/package.json`:
```json
{
  "name": "@repo/contracts-sdk",
  "version": "0.0.0",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "5.9.2"
  }
}
```

Create `packages/contracts-sdk/tsconfig.json`:
```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src"]
}
```

Create `packages/contracts-sdk/src/index.ts`:
```ts
export const AMOY_CHAIN_ID = 80002;
export const AMOY_PUBLIC_RPC = "https://rpc-amoy.polygon.technology/";

export interface BoothMetadata {
  storeName: string;
  address: string;
  coordinates?: string;
  description?: string;
}

export const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const BOOTH_REGISTRY_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getBoothAddresses",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "booths",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "ipfsHash", type: "string" },
      { name: "collateral", type: "uint256" },
      { name: "status", type: "uint8" },
      { name: "submittedAt", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "applyForBooth",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_ipfsHash", type: "string" },
      { name: "_collateralAmount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "reviewBooth",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_vendor", type: "address" },
      { name: "_status", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "cancelApplication",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const;

export const REMITTANCE_ESCROW_ABI = [
  {
    type: "function",
    name: "createOrder",
    stateMutability: "nonpayable",
    inputs: [
      { name: "booth", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "pickupCodeHash", type: "bytes32" },
      { name: "ttlSeconds", type: "uint256" },
    ],
    outputs: [{ name: "orderId", type: "uint256" }],
  },
  {
    type: "function",
    name: "claimOrder",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orderId", type: "uint256" },
      { name: "pickupCode", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "refundExpiredOrder",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "orders",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "sender", type: "address" },
      { name: "booth", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "pickupCodeHash", type: "bytes32" },
      { name: "expiresAt", type: "uint256" },
      { name: "status", type: "uint8" },
    ],
  },
] as const;
```

- [ ] **Step 2: Add `@repo/contracts-sdk` dependency to `apps/web/package.json` and `apps/mobile/package.json`, then install**

Add `"@repo/contracts-sdk": "workspace:*"` to `dependencies` in both `apps/web/package.json` and `apps/mobile/package.json`.

Run: `pnpm install && pnpm turbo run check-types --filter=@repo/contracts-sdk`
Expected: Clean install and `0` TypeScript errors.

- [ ] **Step 3: Commit shared SDK**

```bash
git add packages/contracts-sdk apps/web/package.json apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat: add shared @repo/contracts-sdk workspace package"
```

---

### Task 3: Harden Web App Security, Escrow Claim, and `multicall` Performance (`apps/web`)

**Files:**
- Modify: `apps/web/app/api/ipfs/route.ts`
- Modify: `apps/web/app/admin-dashboard/page.tsx`
- Modify: `apps/web/app/booth-application/page.tsx`
- Modify: `apps/web/app/components/Globe.tsx`

**Interfaces:**
- Consumes: `BOOTH_REGISTRY_ABI`, `REMITTANCE_ESCROW_ABI`, `ERC20_ABI` from `@repo/contracts-sdk`.

- [ ] **Step 1: Secure `apps/web/app/api/ipfs/route.ts` with wallet signature verification**

Require `{ address, signature, timestamp, metadata }` in `POST`, verify `timestamp` is within 5 minutes, verify EIP-191 signature via `viem`'s `verifyMessage`, and whitelist only public store fields (`storeName`, `address`, `coordinates`, `description`) so merchant PII (`email`, `ownerName`) is not pinned to public IPFS:
```ts
import { NextResponse } from "next/server";
import { verifyMessage, isAddress } from "viem";

export async function POST(request: Request) {
  try {
    const pinataJwt = process.env.PINATA_JWT;
    if (!pinataJwt) {
      return NextResponse.json({ error: "Pinata credentials missing" }, { status: 500 });
    }

    const body = await request.json();
    const { address, signature, timestamp, metadata } = body ?? {};

    if (!isAddress(address) || typeof signature !== "string" || typeof timestamp !== "number") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return NextResponse.json({ error: "Expired signature" }, { status: 401 });
    }

    const message = `RemitChain Booth Pin:${address.toLowerCase()}:${timestamp}`;
    const valid = await verifyMessage({
      address,
      message,
      signature: signature as `0x${string}`,
    });
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const safePayload = {
      storeName: String(metadata?.storeName ?? "").slice(0, 120),
      address: String(metadata?.address ?? "").slice(0, 240),
      coordinates: String(metadata?.coordinates ?? "").slice(0, 64),
      description: String(metadata?.description ?? "").slice(0, 500),
    };

    const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pinataJwt}`,
      },
      body: JSON.stringify({
        pinataContent: safePayload,
        pinataMetadata: {
          name: `booth_registry_${safePayload.storeName || "unknown"}_${Date.now()}`,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ error: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ ipfsHash: data.IpfsHash });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to pin metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Replace hardcoded `"admin123"` in `apps/web/app/admin-dashboard/page.tsx` and batch `booths()` with `multicall`**

1. Remove `passcode` state and `handleLogin` (`passcode === "admin123"`). Instead, connect wallet via `window.ethereum`, read `owner()` from `BoothRegistry`, and prompt `walletClient.signMessage` (`RemitChain Admin Login:${Date.now()}`) when `walletAddress.toLowerCase() === contractOwner.toLowerCase()`.
2. Replace the sequential `for (const addr of addresses)` `booths(addr)` + `fetch` loop with `publicClient.multicall` + `Promise.allSettled`.
3. Remove hardcoded `maxFeePerGas: parseGwei("30")` and `maxPriorityFeePerGas: parseGwei("30")` in `reviewBooth`.

- [ ] **Step 3: Wire real `RemittanceEscrow.claimOrder` in `apps/web/app/booth-application/page.tsx`**

1. Sign the pin challenge message before calling `POST /api/ipfs` in `handleApply`.
2. Remove hardcoded `maxFeePerGas` / `maxPriorityFeePerGas` (`parseGwei("30")`) from `approve`, `applyForBooth`, and `cancelApplication`.
3. In `confirmVerifyTransfer`, replace the `localStorage`-only mock with a real `walletClient.writeContract` call to `REMITTANCE_ESCROW_ABI` `claimOrder(BigInt(orderId), pickupCode)` against `process.env.NEXT_PUBLIC_REMITTANCE_ESCROW_ADDRESS`, wait for `waitForTransactionReceipt`, and only then update UI state.

- [ ] **Step 4: Batch `Globe.tsx` with `multicall` and validate coordinates**

In `apps/web/app/components/Globe.tsx`:
1. Use `publicClient.multicall` for all `booths(addr)` calls and `Promise.allSettled` for IPFS metadata fetches.
2. Validate `const lat = parseFloat(parts[0]); const lng = parseFloat(parts[1]);` with `Number.isFinite(lat) && Number.isFinite(lng)` before pushing markers to Leaflet.

- [ ] **Step 5: Verify web build and types**

Run: `pnpm turbo run check-types build --filter=web`
Expected: PASS with 0 TypeScript or Next.js build errors.

- [ ] **Step 6: Commit web changes**

```bash
git add apps/web
git commit -m "feat(web): secure ipfs/admin auth, wire escrow claim, and batch booth queries"
```

---

### Task 4: Harden Mobile Key Management, Wire Escrow Orders, & Fix Runtime Bugs (`apps/mobile`)

**Files:**
- Modify: `apps/mobile/src/config/env.ts`
- Modify: `apps/mobile/src/services/walletService.ts`
- Modify: `apps/mobile/src/screens/BoothsTab.tsx`
- Modify: `apps/mobile/src/screens/DashboardScreen.tsx`
- Modify: `apps/mobile/src/screens/HistoryTab.tsx`
- Modify: `apps/mobile/src/screens/ProfileTab.tsx`
- Modify: `apps/mobile/src/polyfills.ts`

**Interfaces:**
- Consumes: `BOOTH_REGISTRY_ABI`, `REMITTANCE_ESCROW_ABI`, `ERC20_ABI` from `@repo/contracts-sdk`.
- Produces: `walletService.createCashOutOrder(boothAddress: string, amount: string, pickupCode: string, ttlSeconds?: number)`.

- [ ] **Step 1: Update `apps/mobile/src/config/env.ts`**

Move `USDC_ADDRESS`, `BOOTH_REGISTRY_ADDRESS`, `YIELD_VAULT_ADDRESS`, and `REMITTANCE_ESCROW_ADDRESS` to read `process.env.EXPO_PUBLIC_*` so switching between Circle Amoy USDC and `MockUSDC` is a single `.env` change.

- [ ] **Step 2: Fix `walletService.ts` security, precision, caching, and add `createCashOutOrder`**

1. In `getOrCreatePrivateKey()`, throw on `SecureStore.getItemAsync` error instead of generating a new key that orphans funds.
2. Extract a shared `getKernelClient()` helper that caches the Kernel client per active address and uses `PUBLIC_RPC_URL` for read-only `publicClient` calls (`getUSDCBalance`, `getYieldBalance`).
3. Pass `authOptions` consistently in all `SecureStore.getItemAsync(EOA_PRIVATE_KEY_KEY, authOptions)` calls.
4. In `loginWithGoogle()`, surface Web3Auth errors instead of falling back to a random local key and falsely marking `isCloudSynced: true`.
5. In `clearWallet()`, delete `remitchain_custom_txs` and call `web3auth.logout()` when active.
6. Replace `BigInt(Math.floor(parseFloat(amount) * 1_000_000))` with `parseUnits(amount, 6)` and validate recipient addresses with `isAddress`.
7. Add `createCashOutOrder(boothAddress, amount, pickupCode, ttlSeconds = 86400)` encoding `approve` + `RemittanceEscrow.createOrder(boothAddress, parsedAmount, keccak256(toBytes(pickupCode)), BigInt(ttlSeconds))` as a single batched `kernelClient.sendTransaction({ calls: [...] })`.

- [ ] **Step 3: Fix `BoothsTab.tsx`, `DashboardScreen.tsx`, `HistoryTab.tsx`, `ProfileTab.tsx`, and `polyfills.ts`**

1. Replace deprecated `Clipboard` from `'react-native'` with `expo-clipboard` (`npx expo install expo-clipboard`).
2. In `BoothsTab.tsx`, replace `AbortSignal.timeout(3000)` with `AbortController` + `setTimeout`, and batch `booths(addr)` with `publicClient.multicall` + `Promise.allSettled`.
3. In `DashboardScreen.tsx`, validate `isAddress` and positive numeric amounts before sending, store `splitRatio` on the saved transaction record instead of reading live component state in the receipt modal, and expose the escrow cash-out order option when a booth is selected.
4. In `HistoryTab.tsx`, fetch on-chain ERC-20 `Transfer` logs (`publicClient.getLogs`) for the smart account address and merge with local `remitchain_custom_txs` so incoming remittances appear.
5. In `polyfills.ts`, wrap the `10.0.2.2:8081` `SourceCode.scriptURL` override in `if (__DEV__)`.

- [ ] **Step 4: Verify mobile types**

Run: `pnpm turbo run check-types --filter=mobile`
Expected: PASS with 0 TypeScript errors.

- [ ] **Step 5: Commit mobile changes**

```bash
git add apps/mobile
git commit -m "feat(mobile): harden key management, add escrow cash-out orders, and fix runtime bugs"
```
