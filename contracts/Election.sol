// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Election {
    address payable owner;
    bool public isClosed = false;
    uint public registrationFee;

    mapping(address => bool) public candidates;
    mapping(address => bool) voter;
    mapping(address => bool) hasVoted;
    mapping(address => uint) public votes;

    event VoteSubmitted(address candidate, address voter);
    event VoterRegistered(address voter);
    event Closed(uint timestamp);
    event TransferredOwnership(address newOwner);

    modifier notClosed() {
        require(!isClosed, "Election has already closed");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Unauthorized");
        _;
    }

    function transferOwnership(address newOwner) onlyOwner external {
        owner = payable(newOwner);
        emit TransferredOwnership(newOwner);
    }

    constructor(address[] memory _candidates, uint _registrationFee) {
        require(_candidates.length >= 2, "Should atleast have 2 candidates");

        owner = payable(msg.sender);
        registrationFee = _registrationFee;
        for(uint i =0; i < _candidates.length; i++) {
            address candidate = _candidates[i];
            candidates[candidate] = true;
        }
    }

    function vote(address candidate) external notClosed {
        require(voter[msg.sender], "Voter is not registered");
        require(candidates[candidate], "Candidate is not registered");
        require(!hasVoted[msg.sender], "Voter has already voted");

        votes[candidate]+= 1;
        hasVoted[msg.sender] = true;

        emit VoteSubmitted(candidate, msg.sender);
    }

    function register() external payable notClosed {
        require(
            voter[msg.sender] == false,
            "Voter is already registered."
        );
        require(
            msg.value >= registrationFee,
            "Not enough amount for registration fee."
        );

        voter[msg.sender] = true;

        emit VoterRegistered(msg.sender);
    }

    function close() external notClosed onlyOwner {
        isClosed = true;
        owner.transfer(address(this).balance);
        emit Closed(block.timestamp);
    }
}
