using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace API.BackgroundServices;

internal sealed class MessageCleanupService(
    IServiceScopeFactory scopeFactory,
    ILogger<MessageCleanupService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            await Task.Delay(TimeSpan.FromHours(1), stoppingToken);

            if (stoppingToken.IsCancellationRequested)
                break;

            try
            {
                using IServiceScope scope = scopeFactory.CreateScope();
                MessagerDbContext dbContext = scope.ServiceProvider.GetRequiredService<MessagerDbContext>();

                int deleted = await dbContext.Messages
                    .Where(m => m.ExpiresAt < DateTime.UtcNow)
                    .ExecuteDeleteAsync(stoppingToken);

                if (deleted > 0)
                    logger.LogInformation("Deleted {Count} expired messages.", deleted);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Error during expired message cleanup.");
            }
        }
    }
}
