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
