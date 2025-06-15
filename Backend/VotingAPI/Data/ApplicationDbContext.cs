using System;
using Microsoft.EntityFrameworkCore;
using VotingAPI.Models;

namespace VotingAPI.Data
{
    public class ApplicationDbContext : DbContext
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<ApplicationUser> Users { get; set; }
        public DbSet<Vote> Votes { get; set; }
        public DbSet<RegisteredWallet> RegisteredWallets { get; set; }
        public DbSet<ElectionEntity> Elections { get; set; }
        public DbSet<VoteResult> VoteResults { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<ApplicationUser>()
                .HasIndex(u => u.PersonId)
                .IsUnique();

            modelBuilder.Entity<Vote>()
                .HasIndex(v => new { v.PollId, v.UserId })
                .IsUnique();
                
            modelBuilder.Entity<RegisteredWallet>()
                .HasIndex(w => w.WalletAddress)
                .IsUnique();
                
            modelBuilder.Entity<ElectionEntity>()
                .HasKey(e => e.Id);
                
            modelBuilder.Entity<ElectionEntity>()
                .Property(e => e.OptionsJson)
                .IsRequired();
                
            modelBuilder.Entity<VoteResult>()
                .HasIndex(v => new { v.ElectionId, v.OptionIndex })
                .IsUnique();
        }
    }
} 