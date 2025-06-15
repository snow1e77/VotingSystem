using System;
using System.Collections.Generic;
using System.Numerics;
using System.Threading.Tasks;
using VotingAPI.Models;
using VotingAPI.Data;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Threading;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace VotingAPI.Services
{
    public interface IBlockchainSyncService
    {
        Task<SyncResult> SyncFromBlockchainAsync();
        Task<SyncResult> SyncResultsFromBlockchainAsync(int electionId);
        Task StartBackgroundSyncAsync(CancellationToken cancellationToken);
    }

    public class SyncResult
    {
        public int TotalCount { get; set; }
        public int SyncedCount { get; set; }
        public List<SyncDetail> Details { get; set; } = new List<SyncDetail>();
        public string Message { get; set; }
    }

    public class SyncDetail
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Status { get; set; }
        public string Error { get; set; }
    }

    public class BlockchainSyncService : IBlockchainSyncService, IHostedService
    {
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<BlockchainSyncService> _logger;
        private Timer _timer;
        private readonly TimeSpan _syncInterval = TimeSpan.FromMinutes(5);

        public BlockchainSyncService(IServiceScopeFactory scopeFactory, ILogger<BlockchainSyncService> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        // Синхронизация данных из блокчейна в БД
        public async Task<SyncResult> SyncFromBlockchainAsync()
        {
            using var scope = _scopeFactory.CreateScope();
            var blockchainService = scope.ServiceProvider.GetRequiredService<IBlockchainService>();
            var electionService = scope.ServiceProvider.GetRequiredService<IElectionService>();
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var result = new SyncResult
            {
                Details = new List<SyncDetail>()
            };

            try
            {
                _logger.LogInformation("Начинаем синхронизацию с блокчейном...");
                
                // Получаем текущее количество голосований из блокчейна
                var electionCount = await blockchainService.GetElectionCountAsync();
                _logger.LogInformation($"Найдено {electionCount} голосований в блокчейне");
                
                // Синхронизируем каждое голосование
                for (int i = 0; i < electionCount; i++)
                {
                    try
                    {
                        // Получаем информацию о голосовании из блокчейна
                        var electionInfo = await blockchainService.GetElectionInfoAsync(new BigInteger(i));
                        
                        // Проверяем, есть ли голосование уже в БД
                        var localElection = await electionService.GetElectionByIdAsync(i);
                        if (localElection == null)
                        {
                            // Если голосования нет в БД, создаем его
                            // Создаем сущность с указанным Id напрямую, а не через сервис
                            var newElection = new ElectionEntity
                            {
                                Id = i,
                                Name = electionInfo.Name,
                                Description = electionInfo.Description,
                                StartTime = DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.StartTime).UtcDateTime,
                                EndTime = DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.EndTime).UtcDateTime,
                                OptionsJson = System.Text.Json.JsonSerializer.Serialize(electionInfo.Options),
                                Finalized = electionInfo.Finalized,
                                CreatedAt = DateTime.UtcNow
                            };
                            
                            dbContext.Elections.Add(newElection);
                            await dbContext.SaveChangesAsync();
                            
                            result.SyncedCount++;
                            
                            result.Details.Add(new SyncDetail
                            {
                                Id = i,
                                Name = electionInfo.Name,
                                Status = "created"
                            });
                            
                            _logger.LogInformation($"Создано новое голосование в БД: ID={i}, Name={electionInfo.Name}");
                        }
                        else
                        {
                            // Проверяем необходимость обновления
                            bool needsUpdate = localElection.Name != electionInfo.Name ||
                                             localElection.Description != electionInfo.Description ||
                                             localElection.StartTime != DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.StartTime).UtcDateTime ||
                                             localElection.EndTime != DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.EndTime).UtcDateTime ||
                                             localElection.Finalized != electionInfo.Finalized;

                            // Сравниваем опции
                            var localOptions = System.Text.Json.JsonSerializer.Deserialize<List<string>>(localElection.OptionsJson);
                            bool optionsChanged = !localOptions.SequenceEqual(electionInfo.Options);
                            
                            if (needsUpdate || optionsChanged)
                            {
                                // Если голосование уже есть, обновляем его данные
                                localElection.Name = electionInfo.Name;
                                localElection.Description = electionInfo.Description;
                                localElection.StartTime = DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.StartTime).UtcDateTime;
                                localElection.EndTime = DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.EndTime).UtcDateTime;
                                localElection.OptionsJson = System.Text.Json.JsonSerializer.Serialize(electionInfo.Options);
                                localElection.Finalized = electionInfo.Finalized;
                                
                                await electionService.UpdateElectionAsync(localElection);
                                
                                result.SyncedCount++;
                                
                                result.Details.Add(new SyncDetail
                                {
                                    Id = i,
                                    Name = electionInfo.Name,
                                    Status = "updated"
                                });
                                
                                _logger.LogInformation($"Обновлено голосование в БД: ID={i}, Name={electionInfo.Name}");
                            }
                            else
                            {
                                result.Details.Add(new SyncDetail
                                {
                                    Id = i,
                                    Name = electionInfo.Name,
                                    Status = "no_changes"
                                });
                            }
                        }
                        
                        // Если голосование завершено в блокчейне, синхронизируем результаты
                        if (electionInfo.Finalized)
                        {
                            await SyncResultsFromBlockchainAsync(i);
                        }
                        // Если голосование не отмечено как завершенное, но время окончания уже прошло, 
                        // пытаемся получить результаты (возможно, оно завершено, но не отмечено как finalized)
                        else
                        {
                            var endTimeUtc = DateTimeOffset.FromUnixTimeSeconds((long)electionInfo.EndTime).UtcDateTime;
                            if (DateTime.UtcNow > endTimeUtc)
                            {
                                _logger.LogInformation($"Голосование {i} закончилось по времени, но не помечено как finalized в блокчейне");
                                try
                                {
                                    await SyncResultsFromBlockchainAsync(i);
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogWarning($"Не удалось получить результаты для завершенного голосования {i}: {ex.Message}");
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError($"Ошибка при синхронизации голосования {i}: {ex.Message}");
                        result.Details.Add(new SyncDetail
                        {
                            Id = i,
                            Error = ex.Message,
                            Status = "error"
                        });
                    }
                }
                
                result.TotalCount = (int)electionCount;
                result.Message = $"Синхронизация завершена успешно. Синхронизировано {result.SyncedCount} голосований из {electionCount}.";
                
                _logger.LogInformation($"Синхронизация завершена. Синхронизировано {result.SyncedCount} голосований.");
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Ошибка при синхронизации с блокчейном: {ex.Message}");
                
                result.Message = $"Ошибка при синхронизации с блокчейном: {ex.Message}";
                return result;
            }
        }

        // Синхронизация результатов голосования из блокчейна
        public async Task<SyncResult> SyncResultsFromBlockchainAsync(int electionId)
        {
            using var scope = _scopeFactory.CreateScope();
            var blockchainService = scope.ServiceProvider.GetRequiredService<IBlockchainService>();
            var electionService = scope.ServiceProvider.GetRequiredService<IElectionService>();
            var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var result = new SyncResult
            {
                Details = new List<SyncDetail>()
            };

            try
            {
                _logger.LogInformation($"Синхронизация результатов голосования {electionId}...");
                
                // Получаем информацию о голосовании из блокчейна
                var electionInfo = await blockchainService.GetElectionInfoAsync(new BigInteger(electionId));
                
                // Проверяем, завершено ли голосование
                if (!electionInfo.Finalized)
                {
                    result.Message = $"Голосование {electionId} еще не завершено в блокчейне";
                    return result;
                }
                
                // Получаем результаты голосования из блокчейна
                var results = await blockchainService.GetElectionResultsAsync(new BigInteger(electionId));
                
                // Получаем локальное голосование
                var localElection = await electionService.GetElectionByIdAsync(electionId);
                if (localElection == null)
                {
                    result.Message = $"Голосование {electionId} не найдено в локальной БД";
                    return result;
                }
                
                // Устанавливаем флаг завершения голосования
                if (!localElection.Finalized)
                {
                    localElection.Finalized = true;
                    await electionService.UpdateElectionAsync(localElection);
                }
                
                // Получаем опции голосования
                var options = System.Text.Json.JsonSerializer.Deserialize<List<string>>(localElection.OptionsJson);
                
                // Сохраняем результаты в БД
                // Удаляем существующие результаты для этого голосования
                var existingResults = await dbContext.VoteResults.Where(v => v.ElectionId == electionId).ToListAsync();
                if (existingResults.Any())
                {
                    dbContext.VoteResults.RemoveRange(existingResults);
                }
                
                // Добавляем новые результаты
                for (int i = 0; i < results.Count && i < options.Count; i++)
                {
                    dbContext.VoteResults.Add(new VoteResult
                    {
                        ElectionId = electionId,
                        OptionIndex = i,
                        OptionName = options[i],
                        VoteCount = (int)results[i]
                    });
                }
                
                await dbContext.SaveChangesAsync();
                
                result.SyncedCount = 1;
                result.TotalCount = 1;
                result.Message = $"Результаты голосования {electionId} успешно синхронизированы";
                result.Details.Add(new SyncDetail
                {
                    Id = electionId,
                    Name = electionInfo.Name,
                    Status = "results_synced"
                });
                
                _logger.LogInformation($"Результаты голосования {electionId} успешно синхронизированы");
                
                return result;
            }
            catch (Exception ex)
            {
                _logger.LogError($"Ошибка при синхронизации результатов голосования {electionId}: {ex.Message}");
                
                result.Message = $"Ошибка при синхронизации результатов голосования {electionId}: {ex.Message}";
                result.Details.Add(new SyncDetail
                {
                    Id = electionId,
                    Error = ex.Message,
                    Status = "error"
                });
                
                return result;
            }
        }

        // Запуск фонового процесса синхронизации
        public Task StartBackgroundSyncAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Запуск фонового процесса синхронизации с блокчейном");
            
            _timer = new Timer(DoSync, null, TimeSpan.Zero, _syncInterval);
            
            return Task.CompletedTask;
        }

        private async void DoSync(object state)
        {
            try
            {
                _logger.LogInformation("Запуск автоматической синхронизации с блокчейном");
                await SyncFromBlockchainAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Ошибка при автоматической синхронизации: {ex.Message}");
            }
        }

        // Реализация IHostedService для автоматического запуска синхронизации
        public Task StartAsync(CancellationToken cancellationToken)
        {
            return StartBackgroundSyncAsync(cancellationToken);
        }

        public Task StopAsync(CancellationToken cancellationToken)
        {
            _logger.LogInformation("Остановка фонового процесса синхронизации с блокчейном");
            
            _timer?.Change(Timeout.Infinite, 0);
            
            return Task.CompletedTask;
        }
    }
} 