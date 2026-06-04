using System.Security.Claims;
using API.Contracts;
using API.Realtime;
using Application;
using Domain;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Models;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace API.Endpoints;

internal static class KeyExchangeEndpoints
{
    public static RouteGroupBuilder MapKeyExchangeEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/key-exchanges").RequireAuthorization();

        group.MapPost("/", async (
            ClaimsPrincipal user,
            SendKeyExchangeRequest request,
            CurrentPublicKeyAccessor accessor,
            SendKeyExchangeHandler handler,
            MessagerDbContext dbContext,
            SyncNotificationHub syncNotificationHub,
            CancellationToken cancellationToken) =>
        {
            if (!EndpointHelpers.TrySetCurrentPublicKey(user, accessor, out IResult? error))
                return error!;

            try
            {
                KeyExchange keyExchange = handler.Handle(
                    request.ToPublicKey,
                    Convert.FromBase64String(request.EncryptedPrivateKeyBase64));

                KeyExchangeRecord? existing = await dbContext.KeyExchanges
                    .SingleOrDefaultAsync(
                        x => x.FromPublicKey == keyExchange.FromPublicKey && x.ToPublicKey == keyExchange.ToPublicKey,
                        cancellationToken);

                if (existing is null)
                {
                    dbContext.KeyExchanges.Add(new KeyExchangeRecord
                    {
                        FromPublicKey = keyExchange.FromPublicKey,
                        ToPublicKey = keyExchange.ToPublicKey,
                        EncryptedPrivateKey = keyExchange.EncryptedPrivateKey,
                        CreatedAt = DateTime.UtcNow
                    });
                }
                else
                {
                    existing.EncryptedPrivateKey = keyExchange.EncryptedPrivateKey;
                    existing.CreatedAt = DateTime.UtcNow;
                }

                await dbContext.SaveChangesAsync(cancellationToken);
                syncNotificationHub.NotifyKeyExchange(keyExchange.FromPublicKey, keyExchange.ToPublicKey);

                return Results.Ok(new KeyExchangeResponse(
                    keyExchange.FromPublicKey,
                    keyExchange.ToPublicKey,
                    Convert.ToBase64String(keyExchange.EncryptedPrivateKey),
                    keyExchange.CreatedAt));
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

        group.MapGet("/", (
            ClaimsPrincipal user,
            string toPublicKey,
            DateTime? fromDate,
            DateTime? toDate,
            CurrentPublicKeyAccessor accessor,
            GetKeyExchangesHandler handler) =>
        {
            if (!EndpointHelpers.TrySetCurrentPublicKey(user, accessor, out IResult? error))
                return error!;

            try
            {
                IReadOnlyList<KeyExchange> keyExchanges = handler.Handle(toPublicKey, fromDate, toDate);
                return Results.Ok(keyExchanges.Select(x => new KeyExchangeResponse(
                    x.FromPublicKey,
                    x.ToPublicKey,
                    Convert.ToBase64String(x.EncryptedPrivateKey),
                    x.CreatedAt)));
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

        return group;
    }
}
