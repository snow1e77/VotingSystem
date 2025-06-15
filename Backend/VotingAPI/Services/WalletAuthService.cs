using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using Nethereum.Signer;
using Nethereum.Util;
using Nethereum.Web3;

namespace VotingAPI.Services
{
    public interface IWalletAuthService
    {
        string GenerateChallenge(string walletAddress);
        Task<bool> VerifySignature(string walletAddress, string challenge, string signature);
        Task<bool> IsWalletRegistered(string walletAddress);
        Task RegisterWallet(string walletAddress);
    }

    public class WalletAuthService : IWalletAuthService
    {
        private readonly IConfiguration _configuration;
        private readonly Web3 _web3;
        private readonly IVoterRegistryService _voterRegistryService;
        
        // In-memory store for active challenges (in production would use a distributed cache)
        private class ChallengeInfo
        {
            public string Challenge { get; set; }
            public DateTime ExpiresAt { get; set; }
            public int FailedAttempts { get; set; }
        }
        
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, ChallengeInfo> 
            _activeUserChallenges = new System.Collections.Concurrent.ConcurrentDictionary<string, ChallengeInfo>();
            
        // Challenge expiration time in minutes
        private const int CHALLENGE_EXPIRY_MINUTES = 5;
        
        // Maximum failed attempts before requiring a new challenge
        private const int MAX_FAILED_ATTEMPTS = 3;

        public WalletAuthService(IConfiguration configuration, IVoterRegistryService voterRegistryService)
        {
            _configuration = configuration;
            _voterRegistryService = voterRegistryService;
            
            var networkUrl = configuration["Blockchain:Network"];
            _web3 = new Web3(networkUrl);
            
            // Start a background task to clean up expired challenges
            StartCleanupTask();
        }
        
        private void StartCleanupTask()
        {
            Task.Run(async () =>
            {
                while (true)
                {
                    // Clean up expired challenges every minute
                    await Task.Delay(TimeSpan.FromMinutes(1));
                    
                    var now = DateTime.UtcNow;
                    foreach (var walletAddress in _activeUserChallenges.Keys)
                    {
                        if (_activeUserChallenges.TryGetValue(walletAddress, out var info) && 
                            info.ExpiresAt < now)
                        {
                            _activeUserChallenges.TryRemove(walletAddress, out _);
                        }
                    }
                }
            });
        }

        public string GenerateChallenge(string walletAddress)
        {
            // Generate a unique challenge that includes the wallet address and a timestamp
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var nonce = Guid.NewGuid().ToString("N");
            var challenge = $"Verify your identity for VotingSystem. Wallet: {walletAddress}. Timestamp: {timestamp}. Nonce: {nonce}";
            
            // Store the challenge with expiration time
            var challengeInfo = new ChallengeInfo
            {
                Challenge = challenge,
                ExpiresAt = DateTime.UtcNow.AddMinutes(CHALLENGE_EXPIRY_MINUTES),
                FailedAttempts = 0
            };
            
            _activeUserChallenges[walletAddress] = challengeInfo;
            
            return challenge;
        }

        public async Task<bool> VerifySignature(string walletAddress, string challenge, string signature)
        {
            try
            {
                // Check if we have an active challenge for this wallet
                if (!_activeUserChallenges.TryGetValue(walletAddress, out var challengeInfo))
                {
                    return false;
                }
                
                // Check if challenge has expired
                if (challengeInfo.ExpiresAt < DateTime.UtcNow)
                {
                    _activeUserChallenges.TryRemove(walletAddress, out _);
                    return false;
                }
                
                // Check if too many failed attempts
                if (challengeInfo.FailedAttempts >= MAX_FAILED_ATTEMPTS)
                {
                    _activeUserChallenges.TryRemove(walletAddress, out _);
                    return false;
                }
                
                // Verify that this is the challenge we generated for this wallet
                if (challengeInfo.Challenge != challenge)
                {
                    // Increment failed attempts
                    challengeInfo.FailedAttempts++;
                    return false;
                }

                // Verify the signature
                var signer = new EthereumMessageSigner();
                var recoveredAddress = signer.EncodeUTF8AndEcRecover(challenge, signature);
                
                // Compare addresses (case-insensitive)
                var isValid = string.Equals(recoveredAddress, walletAddress, StringComparison.OrdinalIgnoreCase);
                
                if (!isValid)
                {
                    // Increment failed attempts
                    challengeInfo.FailedAttempts++;
                    return false;
                }
                
                // If valid, remove the challenge
                _activeUserChallenges.TryRemove(walletAddress, out _);
                
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error verifying signature: {ex.Message}");
                
                // Increment failed attempts on error
                if (_activeUserChallenges.TryGetValue(walletAddress, out var challengeInfo))
                {
                    challengeInfo.FailedAttempts++;
                }
                
                return false;
            }
        }

        public Task<bool> IsWalletRegistered(string walletAddress)
        {
            return _voterRegistryService.IsWalletRegistered(walletAddress);
        }

        public Task RegisterWallet(string walletAddress)
        {
            return _voterRegistryService.RegisterWallet(walletAddress);
        }
    }
} 