using System;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using VotingAPI.Services;
using VotingAPI.Models;

namespace VotingAPI.Controllers
{
    [ApiController]
    [Route("api/wallet")]
    public class WalletAuthController : ControllerBase
    {
        private readonly IWalletAuthService _walletAuthService;
        private readonly IJwtTokenService _jwtTokenService;
        private readonly VotingAPI.Data.ApplicationDbContext _dbContext;

        public WalletAuthController(
            IWalletAuthService walletAuthService,
            IJwtTokenService jwtTokenService,
            VotingAPI.Data.ApplicationDbContext dbContext)
        {
            _walletAuthService = walletAuthService;
            _jwtTokenService = jwtTokenService;
            _dbContext = dbContext;
        }

        [HttpGet("challenge")]
        [Route("getWalletChallenge")]
        public IActionResult GetChallenge([FromQuery] string walletAddress)
        {
            if (string.IsNullOrEmpty(walletAddress))
            {
                return BadRequest("Wallet address is required");
            }

            // Generate a challenge for the wallet to sign
            string challenge = _walletAuthService.GenerateChallenge(walletAddress);
            return Ok(new { challenge });
        }

        [HttpPost("verify")]
        public async Task<IActionResult> VerifySignature([FromBody] WalletVerificationRequest request)
        {
            if (string.IsNullOrEmpty(request.WalletAddress) || 
                string.IsNullOrEmpty(request.Challenge) || 
                string.IsNullOrEmpty(request.Signature))
            {
                return BadRequest("Wallet address, challenge, and signature are required");
            }

            // Verify the signature
            bool isValid = await _walletAuthService.VerifySignature(
                request.WalletAddress, 
                request.Challenge, 
                request.Signature);

            if (!isValid)
            {
                return BadRequest("Invalid signature");
            }

            // Check if wallet is already registered
            bool isRegistered = await _walletAuthService.IsWalletRegistered(request.WalletAddress);
            if (!isRegistered)
            {
                // Register the wallet
                await _walletAuthService.RegisterWallet(request.WalletAddress);
            }

            // Create a user if it doesn't exist
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                PersonId = request.WalletAddress, // Use wallet address as the person ID
                CreatedAt = DateTime.UtcNow
            };
            
            // Generate a JWT token
            string token = _jwtTokenService.GenerateToken(user);

            return Ok(new { 
                token,
                walletAddress = request.WalletAddress,
                isNewUser = !isRegistered
            });
        }

        [HttpGet("health")]
        public IActionResult HealthCheck()
        {
            return Ok(new { status = "API is running", timestamp = DateTime.UtcNow });
        }

        [HttpGet("test")]
        public IActionResult Test()
        {
            return Ok(new { message = "Test endpoint working", timestamp = DateTime.UtcNow });
        }
    }

    public class WalletVerificationRequest
    {
        public string WalletAddress { get; set; }
        public string Challenge { get; set; }
        public string Signature { get; set; }
    }
} 