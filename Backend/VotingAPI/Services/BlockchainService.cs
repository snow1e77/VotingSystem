using System;
using System.Collections.Generic;
using System.Numerics;
using System.Threading.Tasks;
using Nethereum.Web3;
using Nethereum.Web3.Accounts;
using Nethereum.Contracts;
using Nethereum.Hex.HexTypes;
using Nethereum.ABI.FunctionEncoding.Attributes;
using System.Text.Json;
using System.IO;

namespace VotingAPI.Services
{
    public interface IBlockchainService
    {
        Task<string> CreateElectionAsync(string name, string description, DateTime startTime, DateTime endTime, List<string> options);
        Task<string> ResetAllElectionsAsync();
        Task<BlockchainService.ElectionInfo> GetElectionInfoAsync(BigInteger electionId);
        Task<List<BigInteger>> GetElectionResultsAsync(BigInteger electionId);
        Task<BigInteger> GetElectionCountAsync();
        string GetContractAddress();
        Task<string> GetNetworkNameAsync();
        Task<string> FinalizeElectionAsync(BigInteger electionId);
    }
    
    public class BlockchainService : IBlockchainService
    {
        private readonly Web3 _web3;
        private readonly Contract _contract;
        private readonly string _contractAddress;
        private readonly string _adminPrivateKey;
        private readonly Account _account;

        public BlockchainService(string contractAddress, string adminPrivateKey, string rpcUrl)
        {
            if (string.IsNullOrEmpty(contractAddress))
            {
                throw new ArgumentNullException(nameof(contractAddress), "Contract address cannot be empty");
            }
            
            if (string.IsNullOrEmpty(adminPrivateKey))
            {
                throw new ArgumentNullException(nameof(adminPrivateKey), "Admin private key not configured");
            }
            
            if (string.IsNullOrEmpty(rpcUrl))
            {
                throw new ArgumentNullException(nameof(rpcUrl), "RPC URL not configured");
            }
            
            _contractAddress = contractAddress;
            _adminPrivateKey = adminPrivateKey;
            
            try
            {
                // Initialize Web3 with the admin account
                _account = new Account(adminPrivateKey);
                _web3 = new Web3(_account, rpcUrl);
                
                // Проверяем соединение с узлом блокчейна
                var blockNumber = _web3.Eth.Blocks.GetBlockNumber.SendRequestAsync().Result;
                Console.WriteLine($"Успешное подключение к блокчейну. Текущий блок: {blockNumber}");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при подключении к основному RPC URL: {ex.Message}");
                
                // Пробуем альтернативные URL
                string[] alternativeRpcUrls = new[] {
                    "https://ethereum-sepolia.blockpi.network/v1/rpc/public",
                    "https://rpc2.sepolia.org",
                    "https://sepolia.gateway.tenderly.co"
                };
                
                bool connected = false;
                foreach (var alternativeUrl in alternativeRpcUrls)
                {
                    try
                    {
                        Console.WriteLine($"Пробуем подключиться к альтернативному RPC URL: {alternativeUrl}");
                        _account = new Account(adminPrivateKey);
                        _web3 = new Web3(_account, alternativeUrl);
                        
                        // Проверяем соединение
                        var blockNumber = _web3.Eth.Blocks.GetBlockNumber.SendRequestAsync().Result;
                        Console.WriteLine($"Успешное подключение к альтернативному RPC URL. Текущий блок: {blockNumber}");
                        connected = true;
                        break;
                    }
                    catch (Exception altEx)
                    {
                        Console.WriteLine($"Ошибка при подключении к альтернативному RPC URL: {altEx.Message}");
                    }
                }
                
                if (!connected)
                {
                    throw new Exception("Не удалось подключиться ни к одному RPC URL", ex);
                }
            }
            
            try
            {
                // Load contract ABI from the VotingABI.json file in the project root
                string contractAbiPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "VotingABI.json");
                string contractAbi = System.IO.File.ReadAllText(contractAbiPath);
                _contract = _web3.Eth.GetContract(contractAbi, contractAddress);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error loading contract ABI: {ex.Message}");
                throw;
            }
        }

        // Method to create an election in the blockchain
        public async Task<string> CreateElectionAsync(
            string name,
            string description,
            DateTime startTime,
            DateTime endTime,
            List<string> options)
        {
            try
            {
                // Make sure DateTime is in UTC to avoid timezone issues
                var startTimeUtc = startTime.Kind == DateTimeKind.Unspecified ? 
                    DateTime.SpecifyKind(startTime, DateTimeKind.Utc) : 
                    startTime.ToUniversalTime();
                
                var endTimeUtc = endTime.Kind == DateTimeKind.Unspecified ? 
                    DateTime.SpecifyKind(endTime, DateTimeKind.Utc) : 
                    endTime.ToUniversalTime();
                
                // Convert DateTime to Unix timestamps
                var startTimeUnix = new DateTimeOffset(startTimeUtc).ToUnixTimeSeconds();
                var endTimeUnix = new DateTimeOffset(endTimeUtc).ToUnixTimeSeconds();
                
                // Log the conversion for debugging
                Console.WriteLine($"Converting dates - Start: {startTimeUtc} -> {startTimeUnix}, End: {endTimeUtc} -> {endTimeUnix}");
                
                // Get the function from the contract
                var createElectionFunction = _contract.GetFunction("createElection");
                
                // Estimate gas for the transaction
                var gas = await createElectionFunction.EstimateGasAsync(
                    name,
                    description,
                    new HexBigInteger(startTimeUnix),
                    new HexBigInteger(endTimeUnix),
                    options
                );
                
                // Execute the transaction
                var receipt = await createElectionFunction.SendTransactionAndWaitForReceiptAsync(
                    from: _account.Address,
                    gas: gas,
                    value: null,
                    functionInput: new object[] 
                    { 
                        name, 
                        description, 
                        new HexBigInteger(startTimeUnix), 
                        new HexBigInteger(endTimeUnix), 
                        options 
                    }
                );
                
                return receipt.TransactionHash;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in CreateElectionAsync: {ex.Message}");
                throw;
            }
        }

        // Method to reset all elections in the blockchain
        public async Task<string> ResetAllElectionsAsync()
        {
            try
            {
                // Get the function from the contract
                var resetAllElectionsFunction = _contract.GetFunction("resetAllElections");
                
                // Estimate gas for the transaction
                var gas = await resetAllElectionsFunction.EstimateGasAsync();
                
                // Execute the transaction
                var receipt = await resetAllElectionsFunction.SendTransactionAndWaitForReceiptAsync(
                    from: _account.Address,
                    gas: gas,
                    value: null,
                    functionInput: new object[] {}
                );
                
                return receipt.TransactionHash;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in ResetAllElectionsAsync: {ex.Message}");
                throw;
            }
        }

        // Structure to hold election information
        public class ElectionInfo
        {
            public string Name { get; set; }
            public string Description { get; set; }
            public BigInteger StartTime { get; set; }
            public BigInteger EndTime { get; set; }
            public List<string> Options { get; set; }
            public bool Finalized { get; set; }
        }

        // Method to finalize election in blockchain
        public async Task<string> FinalizeElectionAsync(BigInteger electionId)
        {
            try
            {
                var finalizeFunction = _contract.GetFunction("finalizeElection");
                
                // Estimate gas for the transaction
                var gas = await finalizeFunction.EstimateGasAsync(electionId);
                
                // Execute the transaction
                var receipt = await finalizeFunction.SendTransactionAndWaitForReceiptAsync(
                    from: _account.Address,
                    gas: gas,
                    value: null,
                    functionInput: new object[] { electionId }
                );
                
                return receipt.TransactionHash;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in FinalizeElectionAsync: {ex.Message}");
                throw;
            }
        }

        // Method to get election information from the blockchain
        public async Task<ElectionInfo> GetElectionInfoAsync(BigInteger electionId)
        {
            try
            {
                // Check if the election exists
                try
                {
                    var electionCountFunction = _contract.GetFunction("electionCount");
                    var electionCount = await electionCountFunction.CallAsync<BigInteger>();
                    
                    if (electionId >= electionCount)
                    {
                        throw new Exception($"Election with ID {electionId} does not exist. Total elections: {electionCount}");
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error checking election existence: {ex.Message}");
                    throw;
                }
                
                var getElectionFunction = _contract.GetFunction("getElectionInfo");
                var result = await getElectionFunction.CallDeserializingToObjectAsync<ElectionInfoDTO>(electionId);
                
                return new ElectionInfo
                {
                    Name = result.Name,
                    Description = result.Description,
                    StartTime = result.StartTime,
                    EndTime = result.EndTime,
                    Options = result.Options,
                    Finalized = result.Finalized
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetElectionInfoAsync: {ex.Message}");
                throw;
            }
        }
        
        // Method to get election results from the blockchain
        public async Task<List<BigInteger>> GetElectionResultsAsync(BigInteger electionId)
        {
            try
            {
                var getResultsFunction = _contract.GetFunction("getElectionResults");
                var results = await getResultsFunction.CallAsync<List<BigInteger>>(electionId);
                return results;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error in GetElectionResultsAsync: {ex.Message}");
                throw;
            }
        }
        
        // Метод регистрации избирателей убран - теперь все могут голосовать без предварительной регистрации

        public Task<BigInteger> GetElectionCountAsync()
        {
            try
            {
                var electionCountFunction = _contract.GetFunction("electionCount");
                return electionCountFunction.CallAsync<BigInteger>();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting election count: {ex.Message}");
                throw;
            }
        }

        public string GetContractAddress()
        {
            return _contractAddress;
        }

        public async Task<string> GetNetworkNameAsync()
        {
            try
            {
                var networkId = await _web3.Net.Version.SendRequestAsync();
                string networkName;
                
                switch (networkId)
                {
                    case "1":
                        networkName = "Mainnet";
                        break;
                    case "3":
                        networkName = "Ropsten";
                        break;
                    case "4":
                        networkName = "Rinkeby";
                        break;
                    case "5":
                        networkName = "Goerli";
                        break;
                    case "42":
                        networkName = "Kovan";
                        break;
                    case "11155111":
                        networkName = "Sepolia";
                        break;
                    default:
                        networkName = $"Unknown ({networkId})";
                        break;
                }
                
                return networkName;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error getting network name: {ex.Message}");
                return "Unknown";
            }
        }
    }

    // Data Transfer Object for election information
    [FunctionOutput]
    public class ElectionInfoDTO
    {
        [Parameter("string", "name", 1)]
        public string Name { get; set; }
        
        [Parameter("string", "description", 2)]
        public string Description { get; set; }
        
        [Parameter("uint256", "startTime", 3)]
        public BigInteger StartTime { get; set; }
        
        [Parameter("uint256", "endTime", 4)]
        public BigInteger EndTime { get; set; }
        
        [Parameter("string[]", "options", 5)]
        public List<string> Options { get; set; }
        
        [Parameter("bool", "finalized", 6)]
        public bool Finalized { get; set; }
    }
} 