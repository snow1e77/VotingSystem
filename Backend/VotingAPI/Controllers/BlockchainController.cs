using System;
using System.Collections.Generic;
using System.Numerics;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using VotingAPI.Services;
using System.Linq;

namespace VotingAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class BlockchainController : ControllerBase
    {
        private readonly IBlockchainService _blockchainService;
        private readonly IBlockchainSyncService _blockchainSyncService;
        private readonly IElectionService _electionService;

        public BlockchainController(
            IBlockchainService blockchainService, 
            IBlockchainSyncService blockchainSyncService,
            IElectionService electionService)
        {
            _blockchainService = blockchainService;
            _blockchainSyncService = blockchainSyncService;
            _electionService = electionService;
        }
        
        [HttpPost("sync")]
        public async Task<IActionResult> SyncWithBlockchain()
        {
            try
            {
                var result = await _blockchainSyncService.SyncFromBlockchainAsync();
                
                return Ok(new
                {
                    message = result.Message,
                    totalCount = result.TotalCount,
                    syncedCount = result.SyncedCount,
                    details = result.Details
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при синхронизации с блокчейном: {ex.Message}");
                return StatusCode(500, new { error = "Ошибка при синхронизации с блокчейном", details = ex.Message });
            }
        }
        
        [HttpPost("sync-results/{id}")]
        public async Task<IActionResult> SyncElectionResults(int id)
        {
            try
            {
                var result = await _blockchainSyncService.SyncResultsFromBlockchainAsync(id);
                
                return Ok(new
                {
                    message = result.Message,
                    details = result.Details
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при синхронизации результатов голосования {id}: {ex.Message}");
                return StatusCode(500, new { error = $"Ошибка при синхронизации результатов голосования {id}", details = ex.Message });
            }
        }
        
        [HttpPost("sync-all-results")]
        public async Task<IActionResult> SyncAllElectionResults()
        {
            try
            {
                // Получаем список всех завершенных голосований
                var elections = await _electionService.GetAllElectionsAsync();
                var finalizedElections = elections.Where(e => e.Finalized).ToList();
                
                var results = new List<object>();
                
                foreach (var election in finalizedElections)
                {
                    try
                    {
                        var result = await _blockchainSyncService.SyncResultsFromBlockchainAsync(election.Id);
                        results.Add(new
                        {
                            electionId = election.Id,
                            electionName = election.Name,
                            result = result
                        });
                    }
                    catch (Exception ex)
                    {
                        results.Add(new
                        {
                            electionId = election.Id,
                            electionName = election.Name,
                            error = ex.Message
                        });
                    }
                }
                
                return Ok(new
                {
                    message = $"Синхронизировано результатов: {results.Count} из {finalizedElections.Count}",
                    details = results
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Ошибка при синхронизации всех результатов: {ex.Message}");
                return StatusCode(500, new { error = "Ошибка при синхронизации всех результатов", details = ex.Message });
            }
        }
        
        [HttpGet("status")]
        public async Task<IActionResult> GetBlockchainStatus()
        {
            try
            {
                var contractAddress = _blockchainService.GetContractAddress();
                var networkName = await _blockchainService.GetNetworkNameAsync();
                var electionCount = await _blockchainService.GetElectionCountAsync();
                
                return Ok(new
                {
                    contractAddress,
                    networkName,
                    electionCount,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error retrieving blockchain status", details = ex.Message });
            }
        }
    }
} 