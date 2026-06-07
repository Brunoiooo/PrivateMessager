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

internal static class MessageEndpoints
{
    public static RouteGroupBuilder MapMessageEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/messages").RequireAuthorization();

        group.MapPost("/", async (
            ClaimsPrincipal user,
            SendMessageRequest request,
            CurrentPublicKeyAccessor accessor,
            SendMessageHandler handler,
            MessagerDbContext dbContext,
            SyncNotificationHub syncNotificationHub,
            IConfiguration configuration,
            CancellationToken cancellationToken) =>
        {
            if (!EndpointHelpers.TrySetCurrentPublicKey(user, accessor, out IResult? error))
                return error!;

            int ttlDays = int.TryParse(configuration["MESSAGE_TTL_DAYS"], out int parsed) ? parsed : 30;

            try
            {
                Message message = handler.Handle(
                    request.ToPublicKey,
                    Convert.FromBase64String(request.EncryptedContentBase64),
                    request.MessageHash);

                dbContext.Messages.Add(new MessageRecord
                {
                    FromPublicKey = message.FromPublicKey,
                    ToPublicKey = message.ToPublicKey,
                    EncryptedContent = message.EncryptedContent,
                    MessageHash = message.MessageHash,
                    CreatedAt = DateTime.UtcNow,
                    ExpiresAt = DateTime.UtcNow.AddDays(ttlDays),
                    SignalMessageType = request.SignalMessageType,
                });

                await dbContext.SaveChangesAsync(cancellationToken);
                syncNotificationHub.NotifyMessage(message.FromPublicKey, message.ToPublicKey);

                return Results.Ok(new MessageResponse(
                    message.FromPublicKey,
                    message.ToPublicKey,
                    Convert.ToBase64String(message.EncryptedContent),
                    message.MessageHash,
                    message.CreatedAt,
                    request.SignalMessageType));
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
            GetMessagesHandler handler) =>
        {
            if (!EndpointHelpers.TrySetCurrentPublicKey(user, accessor, out IResult? error))
                return error!;

            try
            {
                IReadOnlyList<Message> messages = handler.Handle(toPublicKey, fromDate, toDate);
                return Results.Ok(messages.Select(x => new MessageResponse(
                    x.FromPublicKey,
                    x.ToPublicKey,
                    Convert.ToBase64String(x.EncryptedContent),
                    x.MessageHash,
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

        group.MapPost("/{messageHash}/ack", async (
            ClaimsPrincipal user,
            string messageHash,
            CurrentPublicKeyAccessor accessor,
            MessagerDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (!EndpointHelpers.TrySetCurrentPublicKey(user, accessor, out IResult? error))
                return error!;

            string callerFingerprint = accessor.GetFingerprintSha512();

            if (!System.Text.RegularExpressions.Regex.IsMatch(messageHash, @"^[0-9a-fA-F]{128}$"))
                return Results.BadRequest(new ErrorResponse("Invalid message hash format."));

            int deleted = await dbContext.Messages
                .Where(m => m.MessageHash == messageHash && m.ToPublicKey == callerFingerprint)
                .ExecuteDeleteAsync(cancellationToken);

            return deleted > 0 ? Results.NoContent() : Results.NotFound();
        });

        return group;
    }
}
