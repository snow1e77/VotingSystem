using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using VotingAPI.Services;

namespace VotingAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VoteController : ControllerBase
    {
        private readonly IVoteService _voteService;

        public VoteController(IVoteService voteService)
        {
            _voteService = voteService;
        }

        [HttpDelete("all")]
        public async Task<IActionResult> DeleteAllVotes()
        {
            try
            {
                int deletedCount = await _voteService.DeleteAllVotesAsync();
                return Ok(new { message = $"Successfully deleted {deletedCount} votes" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error deleting votes", details = ex.Message });
            }
        }
    }
} 