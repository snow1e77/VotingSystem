// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    struct Voter {
        bool hasVoted;
        bytes32 blindedVote; // Blinded vote for anonymity
        uint voteTime;       // Time when the vote was cast
    }
    
    struct Election {
        string name;
        string description;
        uint startTime;
        uint endTime;
        string[] options;
        bool finalized;
        mapping(uint => uint) results; // Option index => vote count
        uint totalVotes;              // Track total votes
    }
    
    // Election ID => Election
    mapping(uint => Election) public elections;
    // Election ID => Voter address => Voter data
    mapping(uint => mapping(address => Voter)) public voters;
    // Secret hashes for vote verification
    mapping(bytes32 => bool) private voteHashes;
    // Track blinded votes for verification
    mapping(bytes32 => address) private blindedVotesToVoter;
    
    uint public electionCount;
    address public admin;
    
    event ElectionCreated(uint electionId, string name, uint startTime, uint endTime);
    event VoteCast(uint electionId, bytes32 voteHash);
    event VoteRevoked(uint electionId, address voter);
    event ElectionFinalized(uint electionId, uint[] results);
    event AllElectionsReset(uint timestamp);
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }
    
    modifier electionExists(uint _electionId) {
        require(_electionId < electionCount, "Election does not exist");
        _;
    }
    
    constructor() {
        admin = msg.sender;
    }
    
    // Only admin can create elections now (no password needed)
    function createElection(
        string memory _name,
        string memory _description,
        uint _startTime,
        uint _endTime,
        string[] memory _options
    ) external onlyAdmin {
        require(_options.length >= 2, "At least 2 options required");
        require(_startTime > block.timestamp, "Start time must be in the future");
        require(_endTime > _startTime, "End time must be after start time");
        
        uint electionId = electionCount++;
        
        Election storage election = elections[electionId];
        election.name = _name;
        election.description = _description;
        election.startTime = _startTime;
        election.endTime = _endTime;
        election.options = _options;
        election.finalized = false;
        election.totalVotes = 0;
        
        emit ElectionCreated(electionId, _name, _startTime, _endTime);
    }
    
    // Reset all elections (only callable by admin)
    function resetAllElections() external onlyAdmin {
        for (uint i = 0; i < electionCount; i++) {
            delete elections[i];
        }
        electionCount = 0;
        
        emit AllElectionsReset(block.timestamp);
    }

    // Голосование без предварительной регистрации - любой может проголосовать
    function vote(uint _electionId, bytes32 _blindedVote, bytes32 _secretHash) external electionExists(_electionId) {
        Election storage election = elections[_electionId];
        Voter storage voter = voters[_electionId][msg.sender];
        
        require(block.timestamp >= election.startTime, "Election has not started");
        require(block.timestamp <= election.endTime, "Election has ended");
        require(!voter.hasVoted, "Voter has already voted");
        require(!voteHashes[_secretHash], "Vote hash already used");
        
        voter.hasVoted = true;
        voter.blindedVote = _blindedVote;
        voter.voteTime = block.timestamp;
        voteHashes[_secretHash] = true;
        blindedVotesToVoter[_blindedVote] = msg.sender;
        election.totalVotes++;
        
        emit VoteCast(_electionId, _secretHash);
    }
    
    // Allow a voter to revoke their vote before the election ends
    function revokeVote(uint _electionId) external electionExists(_electionId) {
        Election storage election = elections[_electionId];
        Voter storage voter = voters[_electionId][msg.sender];
        
        require(block.timestamp <= election.endTime, "Election has ended");
        require(voter.hasVoted, "No vote to revoke");
        
        // Remove the blinded vote mapping
        blindedVotesToVoter[voter.blindedVote] = address(0);
        
        // Reset voter data
        voter.hasVoted = false;
        voter.blindedVote = bytes32(0);
        voter.voteTime = 0;
        
        // Decrease the total vote count
        election.totalVotes--;
        
        emit VoteRevoked(_electionId, msg.sender);
    }
    
    // Admin reveals the vote counts after election ends
    function revealVote(uint _electionId, uint _optionIndex, bytes32 _blindedVote) external onlyAdmin electionExists(_electionId) {
        Election storage election = elections[_electionId];
        
        require(block.timestamp > election.endTime, "Election has not ended");
        require(!election.finalized, "Election already finalized");
        require(_optionIndex < election.options.length, "Invalid option");
        
        // Get the voter address from the blinded vote
        address voterAddress = blindedVotesToVoter[_blindedVote];
        
        // Verify the vote exists and belongs to a voter
        require(voterAddress != address(0), "Vote not found or already counted");
        require(voters[_electionId][voterAddress].hasVoted, "Voter has not voted");
        require(voters[_electionId][voterAddress].blindedVote == _blindedVote, "Vote mismatch");
        
        // Count the vote
        election.results[_optionIndex]++;
        
        // Mark this vote as counted by removing it
        blindedVotesToVoter[_blindedVote] = address(0);
    }
    
    // Для исправления проблемы множественных revealVote добавим пакетную функцию
    function revealVotes(uint _electionId, uint[] calldata _optionIndexes, bytes32[] calldata _blindedVotes) external onlyAdmin electionExists(_electionId) {
        require(_optionIndexes.length == _blindedVotes.length, "Arrays length mismatch");
        
        Election storage election = elections[_electionId];
        
        require(block.timestamp > election.endTime, "Election has not ended");
        require(!election.finalized, "Election already finalized");
        
        for (uint i = 0; i < _blindedVotes.length; i++) {
            uint _optionIndex = _optionIndexes[i];
            bytes32 _blindedVote = _blindedVotes[i];
            
            // Проверка валидности опции
            if (_optionIndex >= election.options.length) continue;
            
            // Get the voter address from the blinded vote
            address voterAddress = blindedVotesToVoter[_blindedVote];
            
            // Проверяем валидность голоса
            if (voterAddress == address(0)) continue; // Пропускаем уже подсчитанные или недействительные голоса
            if (!voters[_electionId][voterAddress].hasVoted) continue;
            if (voters[_electionId][voterAddress].blindedVote != _blindedVote) continue;
            
            // Count the vote
            election.results[_optionIndex]++;
            
            // Mark this vote as counted by removing it
            blindedVotesToVoter[_blindedVote] = address(0);
        }
    }
    
    function finalizeElection(uint _electionId) external onlyAdmin electionExists(_electionId) {
        Election storage election = elections[_electionId];
        
        require(block.timestamp > election.endTime, "Election has not ended");
        require(!election.finalized, "Election already finalized");
        
        election.finalized = true;
        
        // Create result array for the event
        uint[] memory results = new uint[](election.options.length);
        for (uint i = 0; i < election.options.length; i++) {
            results[i] = election.results[i];
        }
        
        emit ElectionFinalized(_electionId, results);
    }
    
    function getElectionInfo(uint _electionId) external view electionExists(_electionId) returns (
        string memory name,
        string memory description,
        uint startTime,
        uint endTime,
        string[] memory options,
        bool finalized,
        uint totalVotes
    ) {
        Election storage election = elections[_electionId];
        return (
            election.name,
            election.description,
            election.startTime,
            election.endTime,
            election.options,
            election.finalized,
            election.totalVotes
        );
    }
    
    function getElectionResults(uint _electionId) external view electionExists(_electionId) returns (uint[] memory) {
        Election storage election = elections[_electionId];
        require(election.finalized, "Election not finalized yet");
        
        uint[] memory results = new uint[](election.options.length);
        for (uint i = 0; i < election.options.length; i++) {
            results[i] = election.results[i];
        }
        
        return results;
    }
    
    function verifyVote(uint _electionId, address _voter) external view returns (bool) {
        return voters[_electionId][_voter].hasVoted;
    }
    
    // Добавляем более подходящее имя функции для проверки голосования
    function hasVoted(uint _electionId, address _voter) external view returns (bool) {
        return voters[_electionId][_voter].hasVoted;
    }
    
    // Get vote timestamp
    function getVoteTimestamp(uint _electionId, address _voter) external view returns (uint) {
        require(voters[_electionId][_voter].hasVoted, "Voter has not voted");
        return voters[_electionId][_voter].voteTime;
    }
} 