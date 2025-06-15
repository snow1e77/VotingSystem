using System;
using System.ComponentModel.DataAnnotations;

namespace VotingAPI.Models
{
    public class RegisteredWallet
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(42)]
        public string WalletAddress { get; set; }
        
        public DateTime RegisteredAt { get; set; }
    }
} 