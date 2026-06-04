using System.Net;
using Api;
using Api.Extensions;
using Application;
using Infrastructure;
using Infrastructure.Persistence;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

string connectionString = builder.Configuration["POSTGRES_CONNECTION_STRING"]
    ?? throw new InvalidOperationException("POSTGRES_CONNECTION_STRING is required.");

string jwtSigningKey = builder.Configuration["JWT_SIGNING_KEY"]
    ?? throw new InvalidOperationException("JWT_SIGNING_KEY is required.");

ConfigureKestrel(builder);

builder.Services
    .RegisterInfrastructureServices(connectionString)
    .RegisterApplicationServices()
    .RegisterApiServices(jwtSigningKey);

WebApplication app = builder.Build();

await EnsureDatabaseCreatedAsync(app);

app.UseApiMiddleware()
   .MapApiEndpoints();

await app.RunAsync();

static void ConfigureKestrel(WebApplicationBuilder builder)
{
    string bindIp = builder.Configuration["API_BIND_IP"] ?? "0.0.0.0";
    string bindPortRaw = builder.Configuration["API_BIND_PORT"] ?? "5000";

    if (!int.TryParse(bindPortRaw, out int bindPort) || bindPort is < 1 or > 65535)
        throw new InvalidOperationException("API_BIND_PORT must be a valid TCP port (1–65535).");

    builder.WebHost.ConfigureKestrel(options =>
    {
        if (bindIp is "*" or "+" or "0.0.0.0")
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
}

static async Task EnsureDatabaseCreatedAsync(WebApplication app)
{
    await using AsyncServiceScope scope = app.Services.CreateAsyncScope();
    MessagerDbContext dbContext = scope.ServiceProvider.GetRequiredService<MessagerDbContext>();
    await dbContext.Database.EnsureCreatedAsync();
}
