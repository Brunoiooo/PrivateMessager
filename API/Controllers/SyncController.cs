using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Api.Contracts;
using Api.Extensions;
using Api.Realtime;
using Application.DTOs;
using Application.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
[Route("/api/sync")]
public sealed class SyncController(IMediator mediator) : ControllerBase
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static readonly Regex FingerprintPattern = new(@"^[0-9a-fA-F]{128}$", RegexOptions.Compiled);

    [HttpGet("delta")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(SyncDeltaResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetDeltaAsync(
        [FromQuery] DateTime? since,
        [FromQuery] int? limit,
        CancellationToken cancellationToken)
    {
        string fingerprint = User.GetFingerprint();

        SyncDeltaDto delta = await mediator.Send(
            new GetSyncDeltaQuery(fingerprint, since, limit, null),
            cancellationToken);

        return Ok(delta.ToResponse());
    }

    [HttpGet("/ws/sync")]
    [AllowAnonymous]
    public async Task HandleInboxWebSocketAsync(
        [FromQuery] DateTime? since,
        [FromQuery] int? limit)
    {
        if (!HttpContext.WebSockets.IsWebSocketRequest)
        {
            HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            await HttpContext.Response.WriteAsync("WebSocket request expected.");
            return;
        }

        if (!HttpContext.User.TryGetFingerprint(out string? fingerprint))
        {
            HttpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        using WebSocket socket = await HttpContext.WebSockets.AcceptWebSocketAsync();
        await StreamSyncAsync(socket, fingerprint!, peerFilter: null, since, limit, HttpContext);
    }

    [HttpGet("/ws/conversations/{peerFingerprint}")]
    [AllowAnonymous]
    public async Task HandleConversationWebSocketAsync(
        string peerFingerprint,
        [FromQuery] DateTime? since,
        [FromQuery] int? limit)
    {
        if (!HttpContext.WebSockets.IsWebSocketRequest)
        {
            HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            await HttpContext.Response.WriteAsync("WebSocket request expected.");
            return;
        }

        if (!HttpContext.User.TryGetFingerprint(out string? fingerprint))
        {
            HttpContext.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return;
        }

        if (!FingerprintPattern.IsMatch(peerFingerprint))
        {
            HttpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            await HttpContext.Response.WriteAsync("peerFingerprint must be a 128-character hexadecimal string.");
            return;
        }

        using WebSocket socket = await HttpContext.WebSockets.AcceptWebSocketAsync();
        await StreamSyncAsync(socket, fingerprint!, peerFingerprint, since, limit, HttpContext);
    }

    private async Task StreamSyncAsync(
        WebSocket socket,
        string fingerprint,
        string? peerFilter,
        DateTime? since,
        int? limit,
        HttpContext context)
    {
        SyncNotificationHub hub = context.RequestServices.GetRequiredService<SyncNotificationHub>();
        int boundedLimit = Math.Clamp(limit ?? 700, 1, 1000);
        DateTime cursor = since?.ToUniversalTime() ?? DateTime.UtcNow;
        long lastVersion = hub.GetVersion(fingerprint, peerFilter);

        cursor = await SendDeltaIfChangedAsync(socket, fingerprint, peerFilter, boundedLimit, cursor, context.RequestServices, context.RequestAborted);

        while (socket.State == WebSocketState.Open && !context.RequestAborted.IsCancellationRequested)
        {
            try
            {
                lastVersion = await hub.WaitForChangeAsync(fingerprint, peerFilter, lastVersion, context.RequestAborted);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            if (socket.State != WebSocketState.Open)
                break;

            cursor = await SendDeltaIfChangedAsync(socket, fingerprint, peerFilter, boundedLimit, cursor, context.RequestServices, context.RequestAborted);
        }
    }

    private async Task<DateTime> SendDeltaIfChangedAsync(
        WebSocket socket,
        string fingerprint,
        string? peerFilter,
        int limit,
        DateTime cursor,
        IServiceProvider services,
        CancellationToken cancellationToken)
    {
        await using AsyncServiceScope scope = services.CreateAsyncScope();
        IMediator scopedMediator = scope.ServiceProvider.GetRequiredService<IMediator>();

        SyncDeltaDto delta = await scopedMediator.Send(
            new GetSyncDeltaQuery(fingerprint, cursor, limit, peerFilter),
            cancellationToken);

        if (delta.Messages.Count == 0 && delta.KeyExchanges.Count == 0)
            return cursor;

        string json = JsonSerializer.Serialize(
            new { type = "sync-delta", payload = delta.ToResponse() },
            JsonOptions);

        await socket.SendAsync(
            Encoding.UTF8.GetBytes(json),
            WebSocketMessageType.Text,
            endOfMessage: true,
            cancellationToken);

        return LatestTimestamp(delta, cursor);
    }

    private static DateTime LatestTimestamp(SyncDeltaDto delta, DateTime fallback)
    {
        DateTime latest = fallback;
        foreach (MessageDto m in delta.Messages)
        {
            DateTime utc = m.CreatedAt.ToUniversalTime();
            if (utc > latest) latest = utc;
        }
        foreach (KeyExchangeDto k in delta.KeyExchanges)
        {
            DateTime utc = k.CreatedAt.ToUniversalTime();
            if (utc > latest) latest = utc;
        }
        return latest;
    }
}
