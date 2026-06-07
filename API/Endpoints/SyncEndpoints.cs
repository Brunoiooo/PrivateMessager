using System.Security.Claims;
using System.IdentityModel.Tokens.Jwt;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using API.Contracts;
using API.Realtime;
using Infrastructure.Persistence;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace API.Endpoints;

internal static class SyncEndpoints
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex FingerprintPattern = new(@"^[0-9a-fA-F]{128}$", RegexOptions.Compiled);

    public static RouteGroupBuilder MapSyncEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/sync").RequireAuthorization();

        group.MapGet("/delta", async (
            ClaimsPrincipal user,
            DateTime? since,
            int? limit,
            CurrentPublicKeyAccessor accessor,
            MessagerDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (!EndpointHelpers.TrySetCurrentPublicKey(user, accessor, out IResult? error))
                return error!;

            string currentPublicKey = accessor.GetFingerprintSha512();
            SyncDeltaResponse delta = await BuildSyncDeltaAsync(
                dbContext,
                currentPublicKey,
                since,
                limit,
                peerFilter: null,
                cancellationToken);

            return Results.Ok(delta);
        });

        app.Map("/ws/sync", async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("WebSocket request expected.");
                return;
            }

            string token = context.Request.Query["access_token"].ToString();
            if (string.IsNullOrWhiteSpace(token))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Missing access_token query parameter.");
                return;
            }

            TokenValidationParameters tokenValidationParameters = context.RequestServices
                .GetRequiredService<TokenValidationParameters>();

            ClaimsPrincipal? user = ValidateToken(token, tokenValidationParameters);
            string? currentPublicKey = user?.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrWhiteSpace(currentPublicKey))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Invalid token.");
                return;
            }

            using WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync();
            DateTime? since = ParseSince(context.Request.Query["since"].ToString());
            int? limit = ParseLimit(context.Request.Query["limit"].ToString());

            await StreamSyncWebSocketAsync(
                webSocket,
                currentPublicKey,
                context.RequestServices,
                since,
                limit,
                peerFilter: null,
                context.RequestAborted);
        });

        app.Map("/ws/conversations/{peerFingerprint}", async context =>
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("WebSocket request expected.");
                return;
            }

            string token = context.Request.Query["access_token"].ToString();
            if (string.IsNullOrWhiteSpace(token))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Missing access_token query parameter.");
                return;
            }

            TokenValidationParameters tokenValidationParameters = context.RequestServices
                .GetRequiredService<TokenValidationParameters>();

            ClaimsPrincipal? user = ValidateToken(token, tokenValidationParameters);
            string? currentPublicKey = user?.FindFirstValue(ClaimTypes.NameIdentifier);
            string? peerFingerprint = context.Request.RouteValues["peerFingerprint"]?.ToString();

            if (string.IsNullOrWhiteSpace(currentPublicKey))
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                await context.Response.WriteAsync("Invalid token.");
                return;
            }

            if (!IsValidFingerprint(peerFingerprint))
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                await context.Response.WriteAsync("peerFingerprint must be a 128-character hexadecimal string.");
                return;
            }

            using WebSocket webSocket = await context.WebSockets.AcceptWebSocketAsync();
            DateTime? since = ParseSince(context.Request.Query["since"].ToString());
            int? limit = ParseLimit(context.Request.Query["limit"].ToString());

            await StreamSyncWebSocketAsync(
                webSocket,
                currentPublicKey,
                context.RequestServices,
                since,
                limit,
                peerFingerprint,
                context.RequestAborted);
        });

        return group;
    }

    private static async Task StreamSyncWebSocketAsync(
        WebSocket webSocket,
        string currentPublicKey,
        IServiceProvider serviceProvider,
        DateTime? initialSince,
        int? limit,
        string? peerFilter,
        CancellationToken cancellationToken)
    {
        SyncNotificationHub syncNotificationHub = serviceProvider.GetRequiredService<SyncNotificationHub>();
        DateTime cursor = initialSince?.ToUniversalTime() ?? DateTime.UtcNow;
        int boundedLimit = Math.Clamp(limit ?? 700, 1, 1000);
        long lastSeenVersion = syncNotificationHub.GetVersion(currentPublicKey, peerFilter);

        cursor = await SendDeltaIfAnyAsync(
            webSocket,
            currentPublicKey,
            serviceProvider,
            peerFilter,
            boundedLimit,
            cursor,
            cancellationToken);

        while (webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
        {
            try
            {
                lastSeenVersion = await syncNotificationHub.WaitForChangeAsync(
                    currentPublicKey,
                    peerFilter,
                    lastSeenVersion,
                    cancellationToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            if (webSocket.State != WebSocketState.Open)
            {
                break;
            }

            cursor = await SendDeltaIfAnyAsync(
                webSocket,
                currentPublicKey,
                serviceProvider,
                peerFilter,
                boundedLimit,
                cursor,
                cancellationToken);
        }
    }

    private static async Task<DateTime> SendDeltaIfAnyAsync(
        WebSocket webSocket,
        string currentPublicKey,
        IServiceProvider serviceProvider,
        string? peerFilter,
        int limit,
        DateTime cursor,
        CancellationToken cancellationToken)
    {
        using IServiceScope scope = serviceProvider.CreateScope();
        MessagerDbContext dbContext = scope.ServiceProvider.GetRequiredService<MessagerDbContext>();

        SyncDeltaResponse delta = await BuildSyncDeltaAsync(
            dbContext,
            currentPublicKey,
            cursor,
            limit,
            peerFilter,
            cancellationToken);

        if (delta.Messages.Count == 0 && delta.KeyExchanges.Count == 0)
        {
            return cursor;
        }

        string responseJson = JsonSerializer.Serialize(new SyncDeltaWebSocketResponse("sync-delta", delta), JsonOptions);
        byte[] responseBytes = Encoding.UTF8.GetBytes(responseJson);
        await webSocket.SendAsync(responseBytes, WebSocketMessageType.Text, endOfMessage: true, cancellationToken);

        return GetCursorFromDelta(delta, cursor);
    }

    private static async Task<SyncDeltaResponse> BuildSyncDeltaAsync(
        MessagerDbContext dbContext,
        string currentPublicKey,
        DateTime? since,
        int? limit,
        string? peerFilter,
        CancellationToken cancellationToken)
    {
        DateTime threshold = since?.ToUniversalTime() ?? DateTime.UnixEpoch;
        int boundedLimit = Math.Clamp(limit ?? 200, 1, 1000);

        IQueryable<Infrastructure.Persistence.Models.MessageRecord> messageQuery = dbContext.Messages
            .Where(x =>
                (x.FromPublicKey == currentPublicKey || x.ToPublicKey == currentPublicKey) &&
                x.CreatedAt > threshold);

        IQueryable<Infrastructure.Persistence.Models.KeyExchangeRecord> keyExchangeQuery = dbContext.KeyExchanges
            .Where(x =>
                (x.FromPublicKey == currentPublicKey || x.ToPublicKey == currentPublicKey) &&
                x.CreatedAt > threshold);

        if (!string.IsNullOrWhiteSpace(peerFilter))
        {
            messageQuery = messageQuery.Where(x =>
                (x.FromPublicKey == peerFilter || x.ToPublicKey == peerFilter));

            keyExchangeQuery = keyExchangeQuery.Where(x =>
                (x.FromPublicKey == peerFilter || x.ToPublicKey == peerFilter));
        }

        List<Infrastructure.Persistence.Models.MessageRecord> messageRecords = await messageQuery
            .OrderBy(x => x.CreatedAt)
            .Take(boundedLimit)
            .ToListAsync(cancellationToken);

        List<Infrastructure.Persistence.Models.KeyExchangeRecord> keyExchangeRecords = await keyExchangeQuery
            .OrderBy(x => x.CreatedAt)
            .Take(boundedLimit)
            .ToListAsync(cancellationToken);

        if (messageRecords.Count == 0 && keyExchangeRecords.Count == 0)
        {
            return new SyncDeltaResponse(DateTime.UtcNow, [], [], []);
        }

        HashSet<string> relatedFingerprints =
        [
            currentPublicKey,
            .. messageRecords.SelectMany(x => new[] { x.FromPublicKey, x.ToPublicKey }),
            .. keyExchangeRecords.SelectMany(x => new[] { x.FromPublicKey, x.ToPublicKey })
        ];

        List<PublicKeyProfileResponse> profiles = await dbContext.PublicKeys
            .Where(x => relatedFingerprints.Contains(x.FingerprintSha512))
            .Select(x => new PublicKeyProfileResponse(
                x.FingerprintSha512,
                x.UserName,
                x.UserTag,
                Convert.ToBase64String(x.Der)))
            .ToListAsync(cancellationToken);

        List<MessageResponse> messages = messageRecords
            .Select(x => new MessageResponse(
                x.FromPublicKey,
                x.ToPublicKey,
                Convert.ToBase64String(x.EncryptedContent),
                x.MessageHash,
                x.CreatedAt,
                x.SignalMessageType))
            .ToList();

        List<KeyExchangeResponse> keyExchanges = keyExchangeRecords
            .Select(x => new KeyExchangeResponse(
                x.FromPublicKey,
                x.ToPublicKey,
                Convert.ToBase64String(x.EncryptedPrivateKey),
                x.CreatedAt))
            .ToList();

        return new SyncDeltaResponse(DateTime.UtcNow, profiles, keyExchanges, messages);
    }

    private static DateTime GetCursorFromDelta(SyncDeltaResponse delta, DateTime fallback)
    {
        DateTime? latestMessage = delta.Messages
            .Select(x => x.CreatedAt.ToUniversalTime())
            .DefaultIfEmpty()
            .Max();

        DateTime? latestKeyExchange = delta.KeyExchanges
            .Select(x => x.CreatedAt.ToUniversalTime())
            .DefaultIfEmpty()
            .Max();

        DateTime latest = fallback;

        if (latestMessage.HasValue && latestMessage.Value > latest)
        {
            latest = latestMessage.Value;
        }

        if (latestKeyExchange.HasValue && latestKeyExchange.Value > latest)
        {
            latest = latestKeyExchange.Value;
        }

        return latest;
    }

    private static DateTime? ParseSince(string raw)
    {
        if (DateTime.TryParse(raw, out DateTime parsed))
        {
            return parsed;
        }

        return null;
    }

    private static int? ParseLimit(string raw)
    {
        if (int.TryParse(raw, out int parsed))
        {
            return parsed;
        }

        return null;
    }

    private static bool IsValidFingerprint(string? fingerprint) =>
        fingerprint is not null && FingerprintPattern.IsMatch(fingerprint);

    private static ClaimsPrincipal? ValidateToken(string token, TokenValidationParameters tokenValidationParameters)
    {
        try
        {
            JwtSecurityTokenHandler handler = new();
            return handler.ValidateToken(token, tokenValidationParameters, out _);
        }
        catch (SecurityTokenException)
        {
            return null;
        }
    }

    private sealed record SyncDeltaWebSocketResponse(string Type, SyncDeltaResponse Payload);
}
