using Api.Contracts;
using Api.Extensions;
using Application.Commands;
using Application.DTOs;
using Application.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Api.Controllers;

[ApiController]
[Authorize]
[Route("/api/messages")]
public sealed class MessagesController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(MessageResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ErrorResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SendMessageAsync(
        [FromBody] SendMessageRequest request,
        CancellationToken cancellationToken)
    {
        string fingerprint = User.GetFingerprint();

        MessageDto message = await mediator.Send(
            new SendMessageCommand(fingerprint, request.ToPublicKey, request.EncryptedContentBase64, request.MessageHash),
            cancellationToken);

        return Ok(message.ToResponse());
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<MessageResponse>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ErrorResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMessagesAsync(
        [FromQuery] string toPublicKey,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken cancellationToken)
    {
        string fingerprint = User.GetFingerprint();

        IReadOnlyList<MessageDto> messages = await mediator.Send(
            new GetMessagesQuery(fingerprint, toPublicKey, fromDate, toDate),
            cancellationToken);

        return Ok(messages.Select(m => m.ToResponse()));
    }
}
