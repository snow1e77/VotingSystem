using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Configuration;
using VotingAPI.Data;
using VotingAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace VotingAPI.Services
{
    public interface IVoterRegistryService
    {
        Task<bool> IsWalletRegistered(string walletAddress);
        Task RegisterWallet(string walletAddress);
        Task<IEnumerable<RegisteredWallet>> GetAllRegisteredWallets();
        Task<bool> UnregisterWallet(string walletAddress);
    }

    public class VoterRegistryService : IVoterRegistryService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IConfiguration _configuration;

        public VoterRegistryService(ApplicationDbContext dbContext, IConfiguration configuration)
        {
            _dbContext = dbContext;
            _configuration = configuration;
        }

        public async Task<bool> IsWalletRegistered(string walletAddress)
        {
            return await _dbContext.RegisteredWallets
                .AnyAsync(w => w.WalletAddress.ToLower() == walletAddress.ToLower());
        }

        public async Task RegisterWallet(string walletAddress)
        {
            // Check if the wallet is already registered
            if (await IsWalletRegistered(walletAddress))
            {
                return;
            }

            // Register the wallet
            var wallet = new RegisteredWallet
            {
                WalletAddress = walletAddress.ToLower(),
                RegisteredAt = DateTime.UtcNow
            };

            _dbContext.RegisteredWallets.Add(wallet);
            await _dbContext.SaveChangesAsync();
        }

        public async Task<IEnumerable<RegisteredWallet>> GetAllRegisteredWallets()
        {
            return await _dbContext.RegisteredWallets.ToListAsync();
        }

        public async Task<bool> UnregisterWallet(string walletAddress)
        {
            var wallet = await _dbContext.RegisteredWallets
                .FirstOrDefaultAsync(w => w.WalletAddress.ToLower() == walletAddress.ToLower());

            if (wallet == null)
            {
                return false;
            }

            _dbContext.RegisteredWallets.Remove(wallet);
            await _dbContext.SaveChangesAsync();
            return true;
        }
    }
} 