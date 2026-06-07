using System.Security.Claims;
using System.Net;
using System.Text;
using System.Threading.RateLimiting;
using API.BackgroundServices;
using API.Endpoints;
using API.Realtime;
using API.Security;
using Application;
using Infrastructure;
using Infrastructure.Persistence;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

string connectionString = builder.Configuration["POSTGRES_CONNECTION_STRING"]
    ?? Environment.GetEnvironmentVariable("POSTGRES_CONNECTION_STRING")
    ?? throw new InvalidOperationException("POSTGRES_CONNECTION_STRING environment variable is required.");

string jwtSigningKey = builder.Configuration["JWT_SIGNING_KEY"]
    ?? Environment.GetEnvironmentVariable("JWT_SIGNING_KEY")
    ?? throw new InvalidOperationException("JWT_SIGNING_KEY environment variable is required.");

string bindIp = builder.Configuration["API_BIND_IP"]
    ?? Environment.GetEnvironmentVariable("API_BIND_IP")
    ?? "0.0.0.0";

string bindPortRaw = builder.Configuration["API_BIND_PORT"]
    ?? Environment.GetEnvironmentVariable("API_BIND_PORT")
    ?? "5000";

if (!int.TryParse(bindPortRaw, out int bindPort) || bindPort is < 1 or > 65535)
    throw new InvalidOperationException("API_BIND_PORT must be a valid TCP port in range 1-65535.");

builder.WebHost.ConfigureKestrel(options =>
{
    if (bindIp == "*" || bindIp == "+" || bindIp == "0.0.0.0")
    {
        options.ListenAnyIP(bindPort);
        return;
    }

    if (bindIp.Equals("localhost", StringComparison.OrdinalIgnoreCase))
    {
        options.ListenLocalhost(bindPort);
        return;
    }

    if (!IPAddress.TryParse(bindIp, out IPAddress? ipAddress))
        throw new InvalidOperationException("API_BIND_IP must be a valid IP address, localhost, *, or +.");

    options.Listen(ipAddress, bindPort);
});

byte[] jwtKeyBytes = Encoding.UTF8.GetBytes(jwtSigningKey);
TokenValidationParameters tokenValidationParameters = new()
{
    ValidateIssuer = true,
    ValidIssuer = JwtTokenIssuer.Issuer,
    ValidateAudience = true,
    ValidAudience = JwtTokenIssuer.Audience,
    ValidateIssuerSigningKey = true,
    IssuerSigningKey = new SymmetricSecurityKey(jwtKeyBytes),
    ValidateLifetime = true,
    ClockSkew = TimeSpan.FromSeconds(30),
    NameClaimType = ClaimTypes.NameIdentifier
};

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = tokenValidationParameters;
    });

builder.Services.AddAuthorization();
builder.Services.AddSingleton(new JwtTokenIssuer(jwtSigningKey));
builder.Services.AddSingleton(tokenValidationParameters);
builder.Services.AddSingleton<SyncNotificationHub>();

builder.Services.AddRateLimiter(options =>
{
    options.AddSlidingWindowLimiter("auth", limiterOptions =>
    {
        limiterOptions.PermitLimit = 10;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.SegmentsPerWindow = 6;
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
    });

    options.AddSlidingWindowLimiter("search", limiterOptions =>
    {
        limiterOptions.PermitLimit = 30;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.SegmentsPerWindow = 6;
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 0;
    });

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
});

builder.Services.AddInfrastructure(connectionString);
builder.Services.AddScoped<RegisterHandler>();
builder.Services.AddScoped<GetLoginChallengeHandler>();
builder.Services.AddScoped<LoginHandler>();
builder.Services.AddScoped<SendMessageHandler>();
builder.Services.AddScoped<GetMessagesHandler>();
builder.Services.AddScoped<SendKeyExchangeHandler>();
builder.Services.AddScoped<GetKeyExchangesHandler>();
builder.Services.AddHostedService<MessageCleanupService>();

WebApplication app = builder.Build();

using (IServiceScope scope = app.Services.CreateScope())
{
    MessagerDbContext dbContext = scope.ServiceProvider.GetRequiredService<MessagerDbContext>();
    dbContext.Database.EnsureCreated();
}

app.UseHttpsRedirection();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromSeconds(30)
});

app.MapAuthEndpoints();
app.MapMessageEndpoints();
app.MapKeyExchangeEndpoints();
app.MapPublicKeyEndpoints();
app.MapSyncEndpoints();
app.MapPreKeyEndpoints();

app.Run();
