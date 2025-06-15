using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace VotingAPI.Models
{
    public class CreateElectionRequest
    {
        [Required]
        public string Name { get; set; }
        
        [Required]
        public string Description { get; set; }
        
        [Required]
        public DateTime StartTime { get; set; }
        
        [Required]
        public DateTime EndTime { get; set; }
        
        [Required]
        [MinLength(2, ErrorMessage = "At least 2 options are required")]
        public List<string> Options { get; set; }
    }
    
    public class ElectionResponse
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public List<string> Options { get; set; }
        public bool Finalized { get; set; }
        public string ImageUrl { get; set; }
        public string CreatorAddress { get; set; }
        public string TransactionHash { get; set; }
        public bool CreatedGaslessly { get; set; }
    }
    
    // Модель RegisterVoterRequest убрана - регистрация избирателей больше не требуется
    
    public class CastVoteRequest
    {
        [Required]
        public int ElectionId { get; set; }
        
        [Required]
        public int OptionIndex { get; set; }
        
        [Required]
        public string VoterSecret { get; set; }
        
        [Required]
        public string VoterPrivateKey { get; set; }
    }
    
    public class ElectionEntity
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public string Name { get; set; }
        
        [Required]
        public string Description { get; set; }
        
        [Required]
        public DateTime StartTime { get; set; }
        
        [Required]
        public DateTime EndTime { get; set; }
        
        [Required]
        public string OptionsJson { get; set; }
        
        public bool Finalized { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        public List<string> Options => 
            !string.IsNullOrEmpty(OptionsJson) 
            ? System.Text.Json.JsonSerializer.Deserialize<List<string>>(OptionsJson)
            : new List<string>();
    }
} 