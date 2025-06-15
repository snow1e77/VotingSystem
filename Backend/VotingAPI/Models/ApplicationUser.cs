using System;

namespace VotingAPI.Models
{
    public class ApplicationUser
    {
        public Guid Id { get; set; }
        public string PersonId { get; set; }
        public DateTime CreatedAt { get; set; }
    }
} 