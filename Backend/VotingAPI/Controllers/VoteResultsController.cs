using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VotingAPI.Data;
using VotingAPI.Models;
using VotingAPI.Services;

namespace VotingAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class VoteResultsController : ControllerBase
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly IBlockchainSyncService _syncService;

        public VoteResultsController(ApplicationDbContext dbContext, IBlockchainSyncService syncService)
        {
            _dbContext = dbContext;
            _syncService = syncService;
        }

        // Получить все результаты голосований
        [HttpGet]
        public async Task<IActionResult> GetAllResults()
        {
            var results = await _dbContext.VoteResults
                .GroupBy(r => r.ElectionId)
                .Select(g => new
                {
                    ElectionId = g.Key,
                    Results = g.Select(r => new
                    {
                        OptionIndex = r.OptionIndex,
                        OptionName = r.OptionName,
                        VoteCount = r.VoteCount
                    }).ToList()
                })
                .ToListAsync();

            return Ok(results);
        }

        // Получить результаты конкретного голосования
        [HttpGet("{electionId}")]
        public async Task<IActionResult> GetElectionResults(int electionId)
        {
            var results = await _dbContext.VoteResults
                .Where(r => r.ElectionId == electionId)
                .Select(r => new
                {
                    OptionIndex = r.OptionIndex,
                    OptionName = r.OptionName,
                    VoteCount = r.VoteCount
                })
                .ToListAsync();

            if (results.Count == 0)
            {
                // Если результаты не найдены, попытаемся синхронизировать их из блокчейна
                await _syncService.SyncResultsFromBlockchainAsync(electionId);
                
                // Повторно запрашиваем результаты
                results = await _dbContext.VoteResults
                    .Where(r => r.ElectionId == electionId)
                    .Select(r => new
                    {
                        OptionIndex = r.OptionIndex,
                        OptionName = r.OptionName,
                        VoteCount = r.VoteCount
                    })
                    .ToListAsync();
            }

            return Ok(new
            {
                ElectionId = electionId,
                Results = results
            });
        }
    }
} 