using System.ComponentModel.DataAnnotations;

namespace VotingAPI.Models
{
    public class VoteResult
    {
        [Key]
        public int Id { get; set; }
        
        public int ElectionId { get; set; }
        
        public int OptionIndex { get; set; }
        
        public string OptionName { get; set; }
        
        public int VoteCount { get; set; }
    }
} 