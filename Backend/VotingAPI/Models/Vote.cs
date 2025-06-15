using System;

namespace VotingAPI.Models
{
    public class Vote
    {
        public int Id { get; set; }
        public int PollId { get; set; }
        public Guid UserId { get; set; }
        public string Choice { get; set; }
    }
} 