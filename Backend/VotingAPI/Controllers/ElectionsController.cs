using System;
using System.Collections.Generic;
using System.Numerics;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using VotingAPI.Models;
using VotingAPI.Services;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using VotingAPI.Data;

namespace VotingAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ElectionsController : ControllerBase
    {
        private readonly IBlockchainService _blockchainService;
        private readonly IElectionService _electionService;
        private readonly ApplicationDbContext _dbContext;

        public ElectionsController(IBlockchainService blockchainService, IElectionService electionService, ApplicationDbContext dbContext)
        {
            _blockchainService = blockchainService;
            _electionService = electionService;
            _dbContext = dbContext;
        }

        [HttpPost]
        public async Task<IActionResult> CreateElection([FromBody] CreateElectionRequest request)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }

            try
            {
                // Сохраняем в блокчейн
                var result = await _blockchainService.CreateElectionAsync(
                    request.Name,
                    request.Description,
                    request.StartTime,
                    request.EndTime,
                    request.Options
                );

                // Сохраняем в локальную БД
                var election = await _electionService.CreateElectionAsync(
                    request.Name,
                    request.Description,
                    request.StartTime,
                    request.EndTime,
                    request.Options
                );

                return Ok(new { status = result, electionId = election.Id });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error creating election", details = ex.Message });
            }
        }

        [HttpGet("{electionId}")]
        public async Task<IActionResult> GetElection(int electionId)
        {
            try
            {
                // Сначала пытаемся получить из локальной базы данных
                var localElection = await _electionService.GetElectionByIdAsync(electionId);

                if (localElection != null)
                {
                    var options = JsonSerializer.Deserialize<List<string>>(localElection.OptionsJson);
                    
                    // Обрабатываем имя, если оно содержит метаданные
                    string name = localElection.Name;
                    string imageUrl = null;
                    
                    if (name != null && name.Contains("|metadata:"))
                    {
                        var parts = name.Split(new string[] { "|metadata:" }, StringSplitOptions.None);
                        if (parts.Length > 0)
                        {
                            name = parts[0].Trim();
                            
                            if (parts.Length > 1)
                            {
                                try
                                {
                                    var metadataJson = parts[1];
                                    Console.WriteLine($"Extracted metadata JSON: {metadataJson}");
                                    var metadata = JsonSerializer.Deserialize<Dictionary<string, string>>(metadataJson);
                                    
                                    if (metadata != null && metadata.ContainsKey("imageUrl"))
                                    {
                                        imageUrl = metadata["imageUrl"];
                                        // Ensure the URL is properly formatted
                                        if (!string.IsNullOrEmpty(imageUrl) && !imageUrl.StartsWith("http"))
                                        {
                                            imageUrl = $"https://{imageUrl}";
                                        }
                                        Console.WriteLine($"Extracted image URL: {imageUrl}");
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"Error parsing metadata in election name: {ex.Message}");
                                    // Try simple extraction if JSON parsing fails
                                    try
                                    {
                                        var simpleMetadata = parts[1];
                                        if (simpleMetadata.Contains("imageUrl"))
                                        {
                                            var urlStart = simpleMetadata.IndexOf("imageUrl") + 10; // 10 = length of "imageUrl":""
                                            var urlEnd = simpleMetadata.IndexOf("\"", urlStart);
                                            if (urlStart > 0 && urlEnd > urlStart)
                                            {
                                                imageUrl = simpleMetadata.Substring(urlStart, urlEnd - urlStart);
                                                Console.WriteLine($"Extracted image URL using fallback method: {imageUrl}");
                                            }
                                        }
                                    }
                                    catch (Exception fallbackEx)
                                    {
                                        Console.WriteLine($"Fallback extraction failed: {fallbackEx.Message}");
                                    }
                                }
                            }
                        }
                    }
                    
                    return Ok(new ElectionResponse
                    {
                        Id = localElection.Id,
                        Name = name,
                        Description = localElection.Description,
                        StartTime = localElection.StartTime,
                        EndTime = localElection.EndTime,
                        Options = options,
                        Finalized = localElection.Finalized,
                        ImageUrl = imageUrl
                    });
                }

                // Если нет в локальной БД, пытаемся получить из блокчейна
                try
                {
                    var electionInfo = await _blockchainService.GetElectionInfoAsync(new BigInteger(electionId));
                    
                    // Обрабатываем имя из блокчейна, если оно содержит метаданные
                    string name = electionInfo.Name;
                    string imageUrl = null;
                    
                    if (name != null && name.Contains("|metadata:"))
                    {
                        var parts = name.Split(new string[] { "|metadata:" }, StringSplitOptions.None);
                        if (parts.Length > 0)
                        {
                            name = parts[0].Trim();
                            
                            if (parts.Length > 1)
                            {
                                try
                                {
                                    var metadataJson = parts[1];
                                    Console.WriteLine($"Extracted metadata JSON: {metadataJson}");
                                    var metadata = JsonSerializer.Deserialize<Dictionary<string, string>>(metadataJson);
                                    
                                    if (metadata != null && metadata.ContainsKey("imageUrl"))
                                    {
                                        imageUrl = metadata["imageUrl"];
                                        // Ensure the URL is properly formatted
                                        if (!string.IsNullOrEmpty(imageUrl) && !imageUrl.StartsWith("http"))
                                        {
                                            imageUrl = $"https://{imageUrl}";
                                        }
                                        Console.WriteLine($"Extracted image URL: {imageUrl}");
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"Error parsing metadata in election name: {ex.Message}");
                                    // Try simple extraction if JSON parsing fails
                                    try
                                    {
                                        var simpleMetadata = parts[1];
                                        if (simpleMetadata.Contains("imageUrl"))
                                        {
                                            var urlStart = simpleMetadata.IndexOf("imageUrl") + 10; // 10 = length of "imageUrl":""
                                            var urlEnd = simpleMetadata.IndexOf("\"", urlStart);
                                            if (urlStart > 0 && urlEnd > urlStart)
                                            {
                                                imageUrl = simpleMetadata.Substring(urlStart, urlEnd - urlStart);
                                                Console.WriteLine($"Extracted image URL using fallback method: {imageUrl}");
                                            }
                                        }
                                    }
                                    catch (Exception fallbackEx)
                                    {
                                        Console.WriteLine($"Fallback extraction failed: {fallbackEx.Message}");
                                    }
                                }
                            }
                        }
                    }
                    
                    // Проверяем валидность временных отметок
                    DateTime startTime, endTime;
                    if (electionInfo.StartTime <= 0)
                    {
                        // Если startTime некорректен, используем текущее время
                        startTime = DateTime.UtcNow;
                        Console.WriteLine($"Invalid StartTime value: {electionInfo.StartTime}. Using current UTC time.");
                    }
                    else
                    {
                        startTime = DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.StartTime).UtcDateTime;
                    }
                    
                    if (electionInfo.EndTime <= 0 || electionInfo.EndTime < electionInfo.StartTime)
                    {
                        // Если endTime некорректен, устанавливаем на неделю позже startTime
                        endTime = startTime.AddDays(7);
                        Console.WriteLine($"Invalid EndTime value: {electionInfo.EndTime}. Setting to StartTime + 7 days.");
                    }
                    else
                    {
                        endTime = DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.EndTime).UtcDateTime;
                    }
                    
                    return Ok(new ElectionResponse
                    {
                        Id = electionId,
                        Name = name,
                        Description = electionInfo.Description,
                        StartTime = startTime,
                        EndTime = endTime,
                        Options = electionInfo.Options,
                        Finalized = electionInfo.Finalized,
                        ImageUrl = imageUrl
                    });
                }
                catch (Exception blockchainEx)
                {
                    Console.WriteLine($"Error retrieving election from blockchain: {blockchainEx.Message}");
                    return NotFound($"Election with ID {electionId} not found in local database or blockchain");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error retrieving election: {ex.Message}");
                return StatusCode(500, new { error = "Error retrieving election", details = ex.Message });
            }
        }

        [HttpGet]
        public async Task<IActionResult> GetAllElections()
        {
            try
            {
                var elections = await _electionService.GetAllElectionsAsync();
                var result = new List<ElectionResponse>();
                
                foreach (var election in elections)
                {
                    var options = JsonSerializer.Deserialize<List<string>>(election.OptionsJson);
                    
                    // Обрабатываем имя, если оно содержит метаданные
                    string name = election.Name;
                    string imageUrl = null;
                    
                    if (name != null && name.Contains("|metadata:"))
                    {
                        var parts = name.Split(new string[] { "|metadata:" }, StringSplitOptions.None);
                        if (parts.Length > 0)
                        {
                            name = parts[0].Trim();
                            
                            if (parts.Length > 1)
                            {
                                try
                                {
                                    var metadataJson = parts[1];
                                    Console.WriteLine($"Extracted metadata JSON: {metadataJson}");
                                    var metadata = JsonSerializer.Deserialize<Dictionary<string, string>>(metadataJson);
                                    
                                    if (metadata != null && metadata.ContainsKey("imageUrl"))
                                    {
                                        imageUrl = metadata["imageUrl"];
                                        // Ensure the URL is properly formatted
                                        if (!string.IsNullOrEmpty(imageUrl) && !imageUrl.StartsWith("http"))
                                        {
                                            imageUrl = $"https://{imageUrl}";
                                        }
                                        Console.WriteLine($"Extracted image URL: {imageUrl}");
                                    }
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"Error parsing metadata in election name: {ex.Message}");
                                    // Try simple extraction if JSON parsing fails
                                    try
                                    {
                                        var simpleMetadata = parts[1];
                                        if (simpleMetadata.Contains("imageUrl"))
                                        {
                                            var urlStart = simpleMetadata.IndexOf("imageUrl") + 10; // 10 = length of "imageUrl":""
                                            var urlEnd = simpleMetadata.IndexOf("\"", urlStart);
                                            if (urlStart > 0 && urlEnd > urlStart)
                                            {
                                                imageUrl = simpleMetadata.Substring(urlStart, urlEnd - urlStart);
                                                Console.WriteLine($"Extracted image URL using fallback method: {imageUrl}");
                                            }
                                        }
                                    }
                                    catch (Exception fallbackEx)
                                    {
                                        Console.WriteLine($"Fallback extraction failed: {fallbackEx.Message}");
                                    }
                                }
                            }
                        }
                    }
                    
                    result.Add(new ElectionResponse
                    {
                        Id = election.Id,
                        Name = name,
                        Description = election.Description,
                        StartTime = election.StartTime,
                        EndTime = election.EndTime,
                        Options = options,
                        Finalized = election.Finalized,
                        ImageUrl = imageUrl
                    });
                }
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error retrieving elections", details = ex.Message });
            }
        }

        // Метод регистрации избирателей убран - теперь все могут голосовать без предварительной регистрации

        [HttpGet("{electionId}/results")]
        public async Task<IActionResult> GetElectionResults(int electionId)
        {
            try
            {
                var results = await _blockchainService.GetElectionResultsAsync(new BigInteger(electionId));
                
                // Получаем названия опций из локальной БД или блокчейна
                var options = await _electionService.GetElectionOptionsAsync(electionId);
                
                if (options == null || options.Count == 0)
                {
                    // Если нет в локальной БД, пытаемся получить из блокчейна
                    var electionInfo = await _blockchainService.GetElectionInfoAsync(new BigInteger(electionId));
                    options = electionInfo.Options;
                }
                
                var formattedResults = new List<object>();
                for (int i = 0; i < options.Count; i++)
                {
                    formattedResults.Add(new
                    {
                        option = options[i],
                        votes = i < results.Count ? (int)results[i] : 0
                    });
                }
                
                return Ok(formattedResults);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error retrieving election results", details = ex.Message });
            }
        }

        // Add a new endpoint to delete all elections from the database
        [HttpDelete("all")]
        public async Task<IActionResult> DeleteAllElections()
        {
            try
            {
                await _electionService.DeleteAllElectionsAsync();
                return Ok(new { message = "All elections have been deleted successfully from the database" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error deleting elections from database", details = ex.Message });
            }
        }
        
        // Add a new endpoint to reset all elections in blockchain
        [HttpPost("reset-blockchain")]
        public async Task<IActionResult> ResetBlockchainElections()
        {
            try
            {
                var result = await _blockchainService.ResetAllElectionsAsync();
                return Ok(new { status = result, message = "All elections have been reset in blockchain" });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error resetting elections in blockchain", details = ex.Message });
            }
        }
        
        // Add an endpoint to delete a single election
        [HttpDelete("{electionId}")]
        public async Task<IActionResult> DeleteElection(int electionId)
        {
            try
            {
                Console.WriteLine($"Attempting to delete election with ID {electionId}");
                
                // First check if the election exists
                var election = await _electionService.GetElectionByIdAsync(electionId);
                if (election == null)
                {
                    Console.WriteLine($"Election with ID {electionId} not found");
                    return NotFound(new { error = $"Election with ID {electionId} not found" });
                }
                
                // Try to get the election from blockchain to see if it exists there
                try
                {
                    var electionInfo = await _blockchainService.GetElectionInfoAsync(new BigInteger(electionId));
                    Console.WriteLine($"Election found in blockchain: {electionInfo.Name}");
                    
                    // Note: We can't actually delete from blockchain, only from our local database
                    Console.WriteLine("Warning: Election can only be deleted from local database, not from blockchain");
                }
                catch (Exception blockchainEx)
                {
                    Console.WriteLine($"Election not found in blockchain or error: {blockchainEx.Message}");
                }
                
                // Delete from database
                var result = await _electionService.DeleteElectionAsync(electionId);
                
                if (!result)
                {
                    Console.WriteLine($"Failed to delete election with ID {electionId} from database");
                    return StatusCode(500, new { error = $"Failed to delete election with ID {electionId}" });
                }
                
                Console.WriteLine($"Successfully deleted election with ID {electionId} from database");
                return Ok(new { message = $"Election with ID {electionId} has been deleted successfully" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error deleting election {electionId}: {ex.Message}\n{ex.StackTrace}");
                return StatusCode(500, new { error = "Error deleting election", details = ex.Message });
            }
        }

        [HttpDelete("reset")]
        public async Task<IActionResult> ResetDatabase()
        {
            try
            {
                // Удаляем все результаты голосований
                var results = await _dbContext.VoteResults.ToListAsync();
                _dbContext.VoteResults.RemoveRange(results);
                
                // Удаляем все голосования
                int deletedCount = await _electionService.DeleteAllElectionsAsync();
                
                return Ok(new { message = $"База данных успешно сброшена. Удалено {deletedCount} голосований и {results.Count} результатов." });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Ошибка при сбросе базы данных", details = ex.Message });
            }
        }

        [HttpGet("{electionId}/status")]
        public async Task<IActionResult> GetElectionStatus(int electionId)
        {
            try
            {
                var election = await _electionService.GetElectionByIdAsync(electionId);
                if (election == null)
                {
                    return NotFound($"Голосование с ID {electionId} не найдено");
                }

                var now = DateTime.UtcNow;
                var status = "unknown";
                var message = "";

                if (now < election.StartTime)
                {
                    status = "pending";
                    message = $"Голосование начнется {election.StartTime.ToLocalTime():dd MMMM yyyy г. HH:mm}";
                }
                else if (now >= election.StartTime && now <= election.EndTime)
                {
                    status = "active";
                    message = $"Голосование активно и закончится {election.EndTime.ToLocalTime():dd MMMM yyyy г. HH:mm}";
                }
                else if (now > election.EndTime)
                {
                    if (election.Finalized)
                    {
                        status = "finalized";
                        message = "Голосование завершено и результаты подведены";
                    }
                    else
                    {
                        status = "ended";
                        message = "Голосование завершено, ожидаются результаты";
                    }
                }

                // Возвращаем дополнительно информацию о текущем времени сервера для диагностики
                return Ok(new
                {
                    electionId,
                    status,
                    message,
                    serverTime = DateTime.UtcNow,
                    localServerTime = DateTime.Now,
                    electionStartTime = election.StartTime,
                    electionEndTime = election.EndTime,
                    electionFinalized = election.Finalized
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Ошибка при получении статуса голосования", details = ex.Message });
            }
        }
    }
} 