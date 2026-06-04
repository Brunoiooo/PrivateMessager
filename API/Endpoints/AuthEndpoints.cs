using API.Contracts;
using API.Security;
using Application;
using Domain;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Models;
using Microsoft.EntityFrameworkCore;

namespace API.Endpoints;

internal static class AuthEndpoints
{
    public static RouteGroupBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/auth").RequireRateLimiting("auth");

        group.MapPost("/register", async (
            RegisterRequest request,
            RegisterHandler handler,
            MessagerDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            try
            {
                byte[] der = Convert.FromBase64String(request.DerBase64);
                PublicKey publicKey = handler.Handle(der, request.UserName, request.UserTag);

                bool exists = await dbContext.PublicKeys
                    .AnyAsync(x => x.FingerprintSha512 == publicKey.FingerprintSha512, cancellationToken);

                if (exists)
                    return Results.Conflict(new ErrorResponse("Public key already registered."));

                DateTime now = DateTime.UtcNow;

                dbContext.PublicKeys.Add(new PublicKeyRecord
                {
                    FingerprintSha512 = publicKey.FingerprintSha512,
                    Der = publicKey.Der,
                    UserName = publicKey.UserName,
                    UserTag = publicKey.UserTag,
                    CreatedAt = now,
                    UpdatedAt = now
                });

                await dbContext.SaveChangesAsync(cancellationToken);

                return Results.Created($"/api/public-keys/{publicKey.FingerprintSha512}", new RegisterResponse(
                    publicKey.FingerprintSha512,
                    publicKey.UserName,
                    publicKey.UserTag));
            }
            catch (FormatException ex)
            {
                return Results.BadRequest(new ErrorResponse(ex.Message));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new ErrorResponse(ex.Message));
            }
            catch (InvalidOperationException ex)
            {
                return Results.BadRequest(new ErrorResponse(ex.Message));
            }
        });

        group.MapPost("/challenge", (
            ChallengeRequest request,
            GetLoginChallengeHandler handler) =>
        {
            try
            {
                byte[] challenge = handler.Handle(request.FingerprintSha512);
                return Results.Ok(new ChallengeResponse(Convert.ToBase64String(challenge)));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new ErrorResponse(ex.Message));
            }
            catch (InvalidOperationException ex)
            {
                return Results.NotFound(new ErrorResponse(ex.Message));
            }
        });

        group.MapPost("/login", (
            LoginRequest request,
            LoginHandler handler,
            JwtTokenIssuer jwtTokenIssuer) =>
        {
            try
            {
                byte[] challenge = Convert.FromBase64String(request.ChallengeBase64);
                byte[] signature = Convert.FromBase64String(request.SignatureBase64);
                handler.Handle(request.FingerprintSha512, challenge, signature);

                (string token, DateTime expiresAtUtc) = jwtTokenIssuer.Generate(request.FingerprintSha512);
                return Results.Ok(new LoginResponse(token, expiresAtUtc));
            }
            catch (FormatException ex)
            {
                return Results.BadRequest(new ErrorResponse(ex.Message));
            }
            catch (ArgumentException ex)
            {
                return Results.BadRequest(new ErrorResponse(ex.Message));
            }
            catch (InvalidOperationException)
            {
                return Results.Unauthorized();
            }
        });

        return group;
    }
}
