using Application;
using Infrastructure.Persistence;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, string connectionString)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(connectionString);

        services.AddDbContext<MessagerDbContext>(options => options.UseNpgsql(connectionString));

        services.AddScoped<IPublicKeySecurityService, PublicKeySecurityService>();
        services.AddScoped<ILoginChallengeService, LoginChallengeService>();
        services.AddScoped<ILoginService, LoginService>();
        services.AddScoped<IPublicKeyRepository, PublicKeyRepository>();

        services.AddSingleton<CurrentPublicKeyAccessor>();
        services.AddSingleton<ICurrentPublicKey>(sp => sp.GetRequiredService<CurrentPublicKeyAccessor>());

        return services;
    }
}
