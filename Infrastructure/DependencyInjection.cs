using Application.Interfaces;
using Infrastructure.Persistence;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection RegisterInfrastructureServices(this IServiceCollection services, string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        services.AddDbContext<MessagerDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IPublicKeySecurityService, PublicKeySecurityService>();
        services.AddScoped<IPublicKeyRepository, PublicKeyRepository>();
        services.AddScoped<IMessageRepository, MessageRepository>();
        services.AddScoped<IKeyExchangeRepository, KeyExchangeRepository>();
        services.AddScoped<ILoginChallengeService, LoginChallengeService>();
        services.AddScoped<ILoginService, LoginService>();

        return services;
    }
}
