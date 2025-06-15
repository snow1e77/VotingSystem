using Microsoft.EntityFrameworkCore;

namespace VotingAPI.Models
{
    public class VotingDbContext : DbContext
    {
        public VotingDbContext(DbContextOptions<VotingDbContext> options) : base(options)
        {
        }

        public DbSet<ElectionEntity> Elections { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            
            modelBuilder.Entity<ElectionEntity>()
                .HasKey(e => e.Id);
                
            modelBuilder.Entity<ElectionEntity>()
                .Property(e => e.OptionsJson)
                .IsRequired();
        }
    }
} 