// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "lib/openzeppelin-contracts/contracts/access/Ownable.sol";

contract BoothRegistry is Ownable {
    IERC20 public immutable usdcToken;
    uint256 public constant MINIMUM_COLLATERAL = 10 * 10**6; // 10 USDC (6 decimals)

    enum Status { Pending, Approved, Rejected }

    struct Booth {
        string ipfsHash;      // IPFS CID containing store details (name, email, coordinates)
        uint256 collateral;   // locked USDC collateral
        Status status;        // Application status
        uint256 submittedAt;  // Block timestamp
    }

    mapping(address => Booth) public booths;
    address[] public boothAddresses;

    event BoothApplied(address indexed vendor, string ipfsHash, uint256 collateral);
    event BoothReviewed(address indexed vendor, Status status);

    constructor(address _usdcToken) Ownable(msg.sender) {
        usdcToken = IERC20(_usdcToken);
    }

    function applyForBooth(string calldata _ipfsHash, uint256 _collateralAmount) external {
        require(_collateralAmount >= MINIMUM_COLLATERAL, "Insufficient collateral stake");
        require(booths[msg.sender].submittedAt == 0, "Application already exists");

        // Transfer USDC collateral from vendor to this registry contract
        require(
            usdcToken.transferFrom(msg.sender, address(this), _collateralAmount),
            "Collateral transfer failed"
        );

        booths[msg.sender] = Booth({
            ipfsHash: _ipfsHash,
            collateral: _collateralAmount,
            status: Status.Pending,
            submittedAt: block.timestamp
        });
        boothAddresses.push(msg.sender);

        emit BoothApplied(msg.sender, _ipfsHash, _collateralAmount);
    }

    function reviewBooth(address _vendor, Status _status) external onlyOwner {
        require(booths[_vendor].submittedAt > 0, "Booth application not found");
        Booth storage booth = booths[_vendor];
        require(booth.status == Status.Pending, "Application already reviewed");

        booth.status = _status;

        // If rejected, return the collateral escrow amount to the vendor address
        if (_status == Status.Rejected) {
            require(
                usdcToken.transfer(_vendor, booth.collateral),
                "Collateral refund failed"
            );
        }

        emit BoothReviewed(_vendor, _status);
    }

    function cancelApplication() external {
        require(booths[msg.sender].submittedAt > 0, "Application not found");
        Booth storage booth = booths[msg.sender];
        require(booth.status == Status.Pending || booth.status == Status.Approved, "Cannot cancel this application");

        uint256 refundAmount = booth.collateral;
        
        // Remove from registry mapping
        delete booths[msg.sender];

        // Remove from boothAddresses list
        for (uint256 i = 0; i < boothAddresses.length; i++) {
            if (boothAddresses[i] == msg.sender) {
                boothAddresses[i] = boothAddresses[boothAddresses.length - 1];
                boothAddresses.pop();
                break;
            }
        }

        require(
            usdcToken.transfer(msg.sender, refundAmount),
            "Collateral refund failed"
        );
    }

    function getBoothAddresses() external view returns (address[] memory) {
        return boothAddresses;
      }
}
