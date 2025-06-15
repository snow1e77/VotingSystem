using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using VotingAPI.Models;
using VotingAPI.Data;

namespace VotingAPI.Services
{
    public interface IElectionService
    {
        Task<int> DeleteAllElectionsAsync();
        Task<ElectionEntity> CreateElectionAsync(string name, string description, DateTime startTime, DateTime endTime, List<string> options);
        Task<ElectionEntity> CreateElectionWithIdAsync(int id, string name, string description, DateTime startTime, DateTime endTime, List<string> options);
        Task<ElectionEntity> GetElectionByIdAsync(int id);
        Task<List<ElectionEntity>> GetAllElectionsAsync();
        Task<bool> FinalizeElectionAsync(int id);
        Task<bool> DeleteElectionAsync(int id);
        Task<List<string>> GetElectionOptionsAsync(int id);
        Task<bool> SetElectionIdAsync(int oldId, int newId);
        Task<bool> UpdateElectionAsync(ElectionEntity election);
    }
    
    public class ElectionService : IElectionService
    {
        private readonly ApplicationDbContext _dbContext;

        public ElectionService(ApplicationDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<int> DeleteAllElectionsAsync()
        {
            var elections = await _dbContext.Elections.ToListAsync();
            _dbContext.Elections.RemoveRange(elections);
            return await _dbContext.SaveChangesAsync();
        }

        public async Task<ElectionEntity> CreateElectionAsync(string name, string description, DateTime startTime, DateTime endTime, List<string> options)
        {
            var electionEntity = new ElectionEntity
            {
                Name = name,
                Description = description,
                StartTime = startTime,
                EndTime = endTime,
                OptionsJson = JsonSerializer.Serialize(options),
                Finalized = false,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Elections.Add(electionEntity);
            await _dbContext.SaveChangesAsync();
            
            return electionEntity;
        }
        
        public async Task<ElectionEntity> CreateElectionWithIdAsync(int id, string name, string description, DateTime startTime, DateTime endTime, List<string> options)
        {
            // Проверяем существование выборов с таким ID
            var existingElection = await _dbContext.Elections.FindAsync(id);
            if (existingElection != null)
            {
                throw new InvalidOperationException($"Выборы с ID {id} уже существуют");
            }
            
            var electionEntity = new ElectionEntity
            {
                Id = id,
                Name = name,
                Description = description,
                StartTime = startTime,
                EndTime = endTime,
                OptionsJson = JsonSerializer.Serialize(options),
                Finalized = false,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Elections.Add(electionEntity);
            await _dbContext.SaveChangesAsync();
            
            return electionEntity;
        }
        
        public async Task<ElectionEntity> GetElectionByIdAsync(int id)
        {
            return await _dbContext.Elections.FindAsync(id);
        }
        
        public async Task<List<ElectionEntity>> GetAllElectionsAsync()
        {
            return await _dbContext.Elections.ToListAsync();
        }
        
        public async Task<bool> FinalizeElectionAsync(int id)
        {
            var election = await _dbContext.Elections.FindAsync(id);
            if (election == null)
            {
                return false;
            }
            
            election.Finalized = true;
            await _dbContext.SaveChangesAsync();
            return true;
        }
        
        public async Task<bool> DeleteElectionAsync(int id)
        {
            var election = await _dbContext.Elections.FindAsync(id);
            if (election == null)
            {
                return false;
            }
            
            _dbContext.Elections.Remove(election);
            await _dbContext.SaveChangesAsync();
            return true;
        }
        
        public async Task<List<string>> GetElectionOptionsAsync(int id)
        {
            var election = await _dbContext.Elections.FindAsync(id);
            if (election == null)
            {
                return new List<string>();
            }
            
            return JsonSerializer.Deserialize<List<string>>(election.OptionsJson);
        }

        public Task<bool> SetElectionIdAsync(int oldId, int newId)
        {
            // Этот метод больше не рекомендуется использовать
            // Вместо него используйте CreateElectionWithIdAsync
            return Task.FromException<bool>(new NotSupportedException("Изменение ID существующего голосования не поддерживается. Используйте CreateElectionWithIdAsync."));
        }

        public async Task<bool> UpdateElectionAsync(ElectionEntity election)
        {
            _dbContext.Elections.Update(election);
            await _dbContext.SaveChangesAsync();
            return true;
        }
    }
} 