using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Api.Middleware;
using Api.Realtime;
using Api.Security;
using Application.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;

namespace Api;

public static class DependencyInjection
{
    public static IServiceCollection RegisterApiServices(this IServiceCollection services, string jwtSigningKey)
    {
        services
            .AddSingleton(new JwtTokenIssuer(jwtSigningKey))
            .AddSingleton<SyncNotificationHub>()
            .AddSingleton<ISyncNotifier, SyncNotificationHubAdapter>();

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = BuildTokenValidationParameters(jwtSigningKey);
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        string? token = context.Request.Query["access_token"];
                        if (!string.IsNullOrWhiteSpace(token))
                            context.Token = token;
                        return Task.CompletedTask;
                    }
                };
            });

        services
            .AddAuthorization()
            .AddExceptionHandler<AppExceptionHandler>()
            .AddProblemDetails()
            .AddControllers();

        services.AddRateLimiter(ConfigureRateLimiting);

        return services;
    }

    private static TokenValidationParameters BuildTokenValidationParameters(string signingKey) => new()
    {
        ValidateIssuer = true,
        ValidIssuer = JwtTokenIssuer.Issuer,
        ValidateAudience = true,
        ValidAudience = JwtTokenIssuer.Audience,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
        ValidateLifetime = true,
        ClockSkew = TimeSpan.FromSeconds(30),
        NameClaimType = ClaimTypes.NameIdentifier
    };

    private static void ConfigureRateLimiting(RateLimiterOptions options)
    {
        options.AddSlidingWindowLimiter("auth", o =>
        {
            o.PermitLimit = 10;
            o.Window = TimeSpan.FromMinutes(1);
            o.SegmentsPerWindow = 6;
            o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            o.QueueLimit = 0;
        });

        options.AddSlidingWindowLimiter("search", o =>
        {
            o.PermitLimit = 30;
            o.Window = TimeSpan.FromMinutes(1);
            o.SegmentsPerWindow = 6;
            o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
            o.QueueLimit = 0;
        });

        options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    }
}
