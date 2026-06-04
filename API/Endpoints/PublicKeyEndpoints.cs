using API.Contracts;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace API.Endpoints;

internal static class PublicKeyEndpoints
{
    public static RouteGroupBuilder MapPublicKeyEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/public-keys").RequireAuthorization().RequireRateLimiting("search");

        group.MapGet("/search", async (
            string userName,
            uint? userTag,
            int? limit,
            MessagerDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            string normalizedUserName = userName.Trim();
            if (normalizedUserName.Length < 2)
                return Results.BadRequest(new ErrorResponse("userName must have at least 2 characters."));

            int boundedLimit = Math.Clamp(limit ?? 25, 1, 100);

            string escapedUserName = normalizedUserName
                .Replace("\\", "\\\\")
                .Replace("%", "\\%")
                .Replace("_", "\\_");

            IQueryable<Infrastructure.Persistence.Models.PublicKeyRecord> query = dbContext.PublicKeys
                .Where(x => EF.Functions.ILike(x.UserName, $"%{escapedUserName}%", "\\"));

            if (userTag.HasValue)
                query = query.Where(x => x.UserTag == userTag.Value);

            IReadOnlyList<PublicKeyProfileResponse> results = await query
                .OrderBy(x => x.UserName)
                .ThenBy(x => x.UserTag)
                .ThenBy(x => x.FingerprintSha512)
                .Take(boundedLimit)
                .Select(x => new PublicKeyProfileResponse(
                    x.FingerprintSha512,
                    x.UserName,
                    x.UserTag,
                    Convert.ToBase64String(x.Der)))
                .ToListAsync(cancellationToken);

            return Results.Ok(results);
        });

        return group;
    }
}
