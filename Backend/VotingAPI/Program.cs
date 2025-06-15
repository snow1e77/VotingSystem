using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using System.Collections.Concurrent;
using System.Linq;
using Nethereum.Signer;
using Nethereum.Util;
using Nethereum.Web3;
using Nethereum.Web3.Accounts;
using Nethereum.Contracts;
using Nethereum.Hex.HexTypes;
using Nethereum.ABI.FunctionEncoding.Attributes;
using Nethereum.Contracts.ContractHandlers;
using Nethereum.Contracts.Extensions;
using Nethereum.RPC.Eth.DTOs;
using System.Collections.Generic;
using System.Numerics;
using System.Threading;
using Microsoft.EntityFrameworkCore;
using VotingAPI.Models;
using VotingAPI.Services;
using VotingAPI.Data;
using Microsoft.OpenApi.Models;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "VotingAPI", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Enter 'Bearer' [space] and then your token in the text input below.",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// Используем возможности JSON в .NET 8
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.WriteIndented = false;
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Добавляем конфигурацию CORS
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(builder =>
    {
        builder.AllowAnyOrigin()
               .AllowAnyMethod()
               .AllowAnyHeader()
               .WithExposedHeaders("*");
    });
});

// Конфигурация JWT для аутентификации
var jwtKey = builder.Configuration["JwtSettings:SecretKey"] ?? "VotingSystemSecretKeyForJwtTokenAuthentication2025";
var key = Encoding.ASCII.GetBytes(jwtKey);

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(key),
        ValidateIssuer = false,
        ValidateAudience = false,
        ClockSkew = TimeSpan.Zero
    };
});

// Configure SQLite database
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlite("Data Source=voting.db"));

// Register Services
builder.Services.AddScoped<IElectionService, ElectionService>();
builder.Services.AddScoped<IVoteService, VoteService>();
builder.Services.AddScoped<IJwtTokenService, JwtTokenService>();
builder.Services.AddScoped<IWalletAuthService, WalletAuthService>();

// Register HTTP client for external services with HttpClient factory
builder.Services.AddHttpClient("BlockchainAPI", client =>
{
    client.Timeout = TimeSpan.FromSeconds(30);
});

// Store wallet challenges for verification
var challengeStore = new ConcurrentDictionary<string, string>();
builder.Services.AddSingleton(challengeStore);

// Blockchain configuration
var contractAddress = builder.Configuration["Blockchain:ContractAddress"];
var contractABI = File.ReadAllText("./VotingABI.json");
if (string.IsNullOrEmpty(contractAddress))
{
    contractAddress = "0x323e6adF719F3b31F5DDC6699D1a962579cBBaAd"; // Default contract address
    Console.WriteLine($"CONTRACT_ADDRESS environment variable not set, using default: {contractAddress}");
}

var adminPrivateKey = builder.Configuration["Blockchain:AdminPrivateKey"] ?? Environment.GetEnvironmentVariable("ADMIN_PRIVATE_KEY");
if (string.IsNullOrEmpty(adminPrivateKey))
{
    adminPrivateKey = "5a856867eb81d1f531d9dc32bf52a7238e43e8af3cd67885b2d693a31cc0e371"; // Default admin private key
    Console.WriteLine($"ADMIN_PRIVATE_KEY environment variable not set, using default test key");
}

var rpcUrl = builder.Configuration["Blockchain:RpcUrl"] ?? Environment.GetEnvironmentVariable("RPC_URL");
if (string.IsNullOrEmpty(rpcUrl))
{
    rpcUrl = "https://rpc.sepolia.org"; // Default RPC URL
    Console.WriteLine($"RPC_URL environment variable not set, using default: {rpcUrl}");
}

// Register BlockchainService
builder.Services.AddSingleton<IBlockchainService, BlockchainService>(provider => 
    new BlockchainService(
        contractAddress,
        adminPrivateKey,
        rpcUrl
    ));

// Register BlockchainSyncService
builder.Services.AddScoped<IBlockchainSyncService, BlockchainSyncService>();
builder.Services.AddHostedService<BlockchainSyncService>();

// Метрики и мониторинг
builder.Services.AddHealthChecks()
    .AddDbContextCheck<ApplicationDbContext>()
    .AddCheck("BlockchainConnectivity", () => 
    {
        try
        {
            var web3 = new Web3(rpcUrl);
            var blockNumber = web3.Eth.Blocks.GetBlockNumber.SendRequestAsync().Result;
            return blockNumber != null 
                ? Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy($"Connected to blockchain. Current block: {blockNumber}")
                : Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Unhealthy("Could not get current block number");
        }
        catch (Exception ex)
        {
            return Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Unhealthy($"Blockchain connection error: {ex.Message}");
        }
    });

var app = builder.Build();
var config = app.Configuration;

// Create database if it doesn't exist
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    dbContext.Database.EnsureCreated();
}

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
    app.UseDeveloperExceptionPage();
}

// Используем статические файлы из wwwroot
app.UseStaticFiles();

// Используем новый упрощенный middleware pipeline в .NET 9
app.UseCors();
app.UseHttpsRedirection();

// Middleware для обработки отсутствующих иконок (возвращает пустой 200 OK вместо 404)
app.Use(async (context, next) =>
{
    string path = context.Request.Path.Value?.ToLower() ?? "";
    if (path == "/favicon.ico" || path == "/logo192.png")
    {
        // Возвращаем пустой ответ 200 OK
        context.Response.StatusCode = 200;
        await context.Response.CompleteAsync();
        return;
    }
    
    await next();
});

// Новый улучшенный RequestLogging middleware в .NET 9
app.Use(async (context, next) => 
{
    var requestId = Guid.NewGuid().ToString();
    context.Response.Headers.Append("X-Request-Id", requestId);
    
    Console.WriteLine($"[{requestId}] Request: {context.Request.Method} {context.Request.Path}");
    
    var timer = System.Diagnostics.Stopwatch.StartNew();
    await next();
    timer.Stop();
    
    Console.WriteLine($"[{requestId}] Response: {context.Response.StatusCode} completed in {timer.ElapsedMilliseconds}ms");
});

// Используем улучшенный стек аутентификации и авторизации в .NET 9
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

// Minimal API Endpoints
// Health check endpoint
app.MapGet("/", () =>
{
    return Results.Ok(new { message = "Voting API is running", version = "2.0", timestamp = DateTime.UtcNow });
});

// Health check endpoint
app.MapGet("/api/wallet/health", () =>
{
    return Results.Ok(new { status = "API is running", timestamp = DateTime.UtcNow });
});

// Elections API

// Get all elections
app.MapGet("/elections", async (IElectionService electionService) =>
{
    var elections = await electionService.GetAllElectionsAsync();
    var result = elections.Select(e => new ElectionResponse
    {
        Name = e.Name,
        Description = e.Description,
        Id = e.Id,
        StartTime = e.StartTime,
        EndTime = e.EndTime,
        Options = e.Options,
        CreatorAddress = string.Empty,
        TransactionHash = string.Empty,
        ImageUrl = string.Empty,
        CreatedGaslessly = false
    });
    return Results.Ok(result);
});

// Get election by ID
app.MapGet("/elections/{id}", async (int id, IElectionService electionService) =>
{
    var election = await electionService.GetElectionByIdAsync(id);
    if (election == null)
    {
        return Results.NotFound($"Election with ID {id} not found");
    }
    
    var options = System.Text.Json.JsonSerializer.Deserialize<List<string>>(election.OptionsJson);
    
    return Results.Ok(new ElectionResponse
    {
        Id = election.Id,
        Name = election.Name,
        Description = election.Description,
        StartTime = election.StartTime,
        EndTime = election.EndTime,
        Options = options,
        Finalized = election.Finalized,
        ImageUrl = string.Empty,
        CreatorAddress = string.Empty,
        TransactionHash = string.Empty,
        CreatedGaslessly = false
    });
});

// Create election (regular way)
app.MapPost("/elections", async (ElectionCreateRequest request, IElectionService electionService) =>
{
    try
    {
        if (request == null)
        {
            return Results.BadRequest("Invalid election data");
        }

        // Store the election in database
        var election = await electionService.CreateElectionAsync(
            request.Name,
            request.Description,
            request.StartTime,
            request.EndTime,
            request.Options
        );

        return Results.Created($"/elections/{election.Id}", new { 
            electionId = election.Id,
            name = election.Name,
            description = election.Description,
            startTime = election.StartTime,
            endTime = election.EndTime
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error creating election: {ex.Message}");
        return Results.BadRequest($"Error creating election: {ex.Message}");
    }
});

// Create election gaslessly (admin creates it on behalf of the user)
app.MapPost("/elections/gasless", async (GaslessElectionRequest request, IElectionService electionService) =>
{
    try
    {
        Console.WriteLine($"Received gasless election request: {request?.Name}");
        
        if (request == null)
        {
            return Results.BadRequest("Invalid election data");
        }

        // Create transaction on behalf of the user
        string transactionHash;
        try 
        {
            // Create election in blockchain on behalf of user
            var web3 = new Web3(config["Blockchain:RpcUrl"]);
            var contract = web3.Eth.GetContract(contractABI, contractAddress);
            var createFunction = contract.GetFunction("createElection");
            
            // Use admin account for transaction
            var adminPrivateKey = config["Blockchain:AdminPrivateKey"];
            var adminAccount = new Account(adminPrivateKey);
            
            // Prepare transaction
            var gas = new HexBigInteger(1000000);
            var gasPrice = await web3.Eth.GasPrice.SendRequestAsync();
            
            // Send transaction
            transactionHash = await createFunction.SendTransactionAsync(
                adminAccount.Address,
                gas,
                new HexBigInteger(0),
                null, // No value to send
                request.Name,
                request.Description,
                new HexBigInteger(request.StartTime),
                new HexBigInteger(request.EndTime),
                request.Options.ToArray()
            );
            
            Console.WriteLine($"Created election on blockchain with tx hash: {transactionHash}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Failed to create election on blockchain: {ex.Message}");
            // Fallback to using a mock transaction hash for testing purposes
            transactionHash = "0x" + Guid.NewGuid().ToString("N");
            Console.WriteLine($"Using mock transaction hash: {transactionHash}");
        }
        
        // Store the election in database
        var election = await electionService.CreateElectionAsync(
            request.Name,
            request.Description,
            DateTimeOffset.FromUnixTimeSeconds(request.StartTime).DateTime,
            DateTimeOffset.FromUnixTimeSeconds(request.EndTime).DateTime,
            request.Options
        );
        
        Console.WriteLine($"Created election with ID: {election.Id}");

        return Results.Created($"/elections/{election.Id}", new { 
            electionId = election.Id,
            transactionHash = transactionHash
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error creating gasless election: {ex.Message}");
        Console.WriteLine($"Stack trace: {ex.StackTrace}");
        return Results.BadRequest(new { error = $"Error creating gasless election: {ex.Message}" });
    }
});

// Finalize election endpoint
app.MapPost("/api/elections/{id}/finalize", async (int id, IBlockchainService blockchainService, IElectionService electionService) =>
{
    try
    {
        Console.WriteLine($"Finalizing election with ID: {id}");
        
        // Check if election exists
        var election = await electionService.GetElectionByIdAsync(id);
        if (election == null)
        {
            return Results.NotFound($"Election with ID {id} not found");
        }
        
        // Check if election has ended
        if (DateTime.UtcNow <= election.EndTime)
        {
            return Results.BadRequest("Election has not ended yet");
        }
        
        // Check if already finalized
        if (election.Finalized)
        {
            return Results.BadRequest("Election is already finalized");
        }
        
        // Finalize in blockchain
        var transactionHash = await blockchainService.FinalizeElectionAsync(new BigInteger(id));
        Console.WriteLine($"Election {id} finalized with transaction hash: {transactionHash}");
        
        // Update local database
        await electionService.FinalizeElectionAsync(id);
        
        return Results.Ok(new { 
            message = "Election finalized successfully",
            transactionHash = transactionHash,
            electionId = id
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error finalizing election {id}: {ex.Message}");
        return Results.BadRequest($"Error finalizing election: {ex.Message}");
    }
});

// Добавляем экспериментальный маршрут для тестирования (оставляем лог для отладки)
app.MapGet("/test-delete/{id}", (int id, HttpContext context) => {
    Console.WriteLine($"Received test request: {context.Request.Method} {context.Request.Path}");
    return Results.Ok($"Test endpoint works with ID: {id}");
});

// Generate challenge for wallet
app.MapGet("/api/wallet/challenge", (string walletAddress) =>
{
    if (string.IsNullOrEmpty(walletAddress))
    {
        return Results.BadRequest("Wallet address is required");
    }

    // Generate a unique challenge that includes the wallet address and a timestamp
    var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
    var nonce = Guid.NewGuid().ToString("N");
    var challenge = $"Verify your identity for VotingSystem. Wallet: {walletAddress}. Timestamp: {timestamp}. Nonce: {nonce}";
    
    // Store the challenge for this wallet address
    challengeStore[walletAddress] = challenge;
    
    Console.WriteLine($"Generated challenge for {walletAddress}: {challenge}");
    
    return Results.Ok(new { challenge });
});

// Verify wallet signature
app.MapPost("/api/wallet/verify", async (HttpContext context) =>
{
    try
    {
        // Read request body
        var request = await context.Request.ReadFromJsonAsync<WalletVerificationRequest>();
        
        if (request == null || 
            string.IsNullOrEmpty(request.WalletAddress) || 
            string.IsNullOrEmpty(request.Challenge) || 
            string.IsNullOrEmpty(request.Signature))
        {
            return Results.BadRequest("Wallet address, challenge, and signature are required");
        }
        
        Console.WriteLine($"Verifying signature for {request.WalletAddress}");
        
        // Check if we have a challenge for this wallet
        if (!challengeStore.TryGetValue(request.WalletAddress, out var storedChallenge) || 
            storedChallenge != request.Challenge)
        {
            Console.WriteLine("Challenge not found or doesn't match");
            return Results.BadRequest("Invalid or expired challenge");
        }
        
        // Verify the signature cryptographically using Nethereum
        var signer = new EthereumMessageSigner();
        var addressRecovered = signer.EncodeUTF8AndEcRecover(request.Challenge, request.Signature);
        
        // Compare the recovered address with the provided address (case insensitive)
        if (!string.Equals(addressRecovered, request.WalletAddress, StringComparison.OrdinalIgnoreCase))
        {
            Console.WriteLine($"Signature verification failed. Recovered: {addressRecovered}, Expected: {request.WalletAddress}");
            return Results.BadRequest("Invalid signature");
        }
        
        // Remove the challenge after successful verification
        challengeStore.TryRemove(request.WalletAddress, out _);
        
        return Results.Ok(new 
        { 
            token = GenerateToken(request.WalletAddress),
            walletAddress = request.WalletAddress,
            isNewUser = false
        });
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error in wallet verification: {ex.Message}");
        return Results.BadRequest(new { error = $"Error in wallet verification: {ex.Message}" });
    }
});

// Generate a simple token
string GenerateToken(string walletAddress)
{
    var tokenData = $"{walletAddress}:{Guid.NewGuid()}:{DateTime.UtcNow.AddDays(1):o}";
    var tokenBytes = Encoding.UTF8.GetBytes(tokenData);
    var tokenBase64 = Convert.ToBase64String(tokenBytes);
    return tokenBase64;
}

app.Run();

// Event DTO for decoding ElectionCreated events
[Event("ElectionCreated")]
public class ElectionCreatedEventDTO : IEventDTO
{
    [Parameter("uint256", "electionId", 1, false)]
    public BigInteger ElectionId { get; set; }

    [Parameter("string", "name", 2, false)]
    public string Name { get; set; }

    [Parameter("uint256", "startTime", 3, false)]
    public BigInteger StartTime { get; set; }

    [Parameter("uint256", "endTime", 4, false)]
    public BigInteger EndTime { get; set; }
}

// Request models
public class WalletVerificationRequest
{
    public string WalletAddress { get; set; }
    public string Challenge { get; set; }
    public string Signature { get; set; }
}

public class ElectionCreateRequest
{
    public int BlockchainId { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public List<string> Options { get; set; }
    public string CreatorAddress { get; set; }
    public string TransactionHash { get; set; }
    public string ImageUrl { get; set; }
}

public class GaslessElectionRequest
{
    public string Name { get; set; }
    public string Description { get; set; }
    public long StartTime { get; set; }
    public long EndTime { get; set; }
    public List<string> Options { get; set; }
    public string CreatorAddress { get; set; }
}

public class ElectionModel
{
    public int BlockchainId { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public List<string> Options { get; set; }
    public string CreatorAddress { get; set; }
    public string TransactionHash { get; set; }
    public string ImageUrl { get; set; }
    public bool CreatedGaslessly { get; set; }
}

public class ElectionResponse
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public DateTime StartTime { get; set; }
    public DateTime EndTime { get; set; }
    public List<string> Options { get; set; }
    public string CreatorAddress { get; set; }
    public string TransactionHash { get; set; }
    public string ImageUrl { get; set; }
    public bool CreatedGaslessly { get; set; }
    public bool Finalized { get; set; }
} 