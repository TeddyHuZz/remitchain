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
    uint256 public constant COOLDOWN_PERIOD = 1 days;

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
    mapping(address => uint256) public exitRequestedAt;
    mapping(address => uint256) private boothIndex;
    address[] public boothAddresses;

    event BoothApplied(address indexed vendor, string ipfsHash, uint256 collateral);
    event BoothReviewed(address indexed vendor, Status status);
    event ExitRequested(address indexed vendor, uint256 unlockAt);
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

        booths[msg.sender] = Booth({
            ipfsHash: _ipfsHash,
            collateral: _collateralAmount,
            status: Status.Pending,
            submittedAt: block.timestamp
        });
        exitRequestedAt[msg.sender] = 0;

        if (boothIndex[msg.sender] == 0) {
            boothAddresses.push(msg.sender);
            boothIndex[msg.sender] = boothAddresses.length;
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

    function revokeBooth(address _vendor) external onlyOwner nonReentrant {
        Booth storage booth = booths[_vendor];
        require(booth.submittedAt > 0 && booth.status == Status.Approved, "Booth not approved");
        booth.status = Status.Rejected;
        exitRequestedAt[_vendor] = 0;
        uint256 refundAmount = booth.collateral;
        booth.collateral = 0;
        usdcToken.safeTransfer(_vendor, refundAmount);
        emit BoothReviewed(_vendor, Status.Rejected);
    }

    function requestExit() external {
        Booth storage booth = booths[msg.sender];
        require(booth.submittedAt > 0 && booth.status == Status.Approved, "Booth not approved");
        require(exitRequestedAt[msg.sender] == 0, "Exit already requested");
        exitRequestedAt[msg.sender] = block.timestamp;
        emit ExitRequested(msg.sender, block.timestamp + COOLDOWN_PERIOD);
    }

    function cancelApplication() external nonReentrant {
        Booth storage booth = booths[msg.sender];
        require(booth.submittedAt > 0, "Application not found");
        require(
            booth.status == Status.Pending || booth.status == Status.Approved,
            "Cannot cancel this application"
        );

        if (booth.status == Status.Approved) {
            uint256 requestedAt = exitRequestedAt[msg.sender];
            require(requestedAt > 0 && block.timestamp >= requestedAt + COOLDOWN_PERIOD, "Cooldown active");
        }

        uint256 refundAmount = booth.collateral;
        delete booths[msg.sender];
        exitRequestedAt[msg.sender] = 0;

        uint256 idx = boothIndex[msg.sender];
        if (idx > 0) {
            uint256 lastIdx = boothAddresses.length;
            if (idx != lastIdx) {
                address lastAddr = boothAddresses[lastIdx - 1];
                boothAddresses[idx - 1] = lastAddr;
                boothIndex[lastAddr] = idx;
            }
            boothAddresses.pop();
            delete boothIndex[msg.sender];
        }

        usdcToken.safeTransfer(msg.sender, refundAmount);
        emit ApplicationCancelled(msg.sender, refundAmount);
    }

    function getBoothAddresses() external view returns (address[] memory) {
        return boothAddresses;
    }
}
