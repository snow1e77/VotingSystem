using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using VotingAPI.Data;

namespace VotingAPI.Services
{
    public interface IVoteService
    {
        Task<int> DeleteAllVotesAsync();
    }

    public class VoteService : IVoteService
    {
        private readonly ApplicationDbContext _dbContext;

        public VoteService(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<int> DeleteAllVotesAsync()
        {
            var votes = await _dbContext.Votes.ToListAsync();
            _dbContext.Votes.RemoveRange(votes);
            return await _dbContext.SaveChangesAsync();
        }
    }
} 