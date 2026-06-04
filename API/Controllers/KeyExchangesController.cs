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
[Route("/api/key-exchanges")]
public sealed class KeyExchangesController(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(KeyExchangeResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ErrorResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SendKeyExchangeAsync(
        [FromBody] SendKeyExchangeRequest request,
        CancellationToken cancellationToken)
    {
        string fingerprint = User.GetFingerprint();

        KeyExchangeDto keyExchange = await mediator.Send(
            new SendKeyExchangeCommand(fingerprint, request.ToPublicKey, request.EncryptedPrivateKeyBase64),
            cancellationToken);

        return Ok(keyExchange.ToResponse());
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<KeyExchangeResponse>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ErrorResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetKeyExchangesAsync(
        [FromQuery] string toPublicKey,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken cancellationToken)
    {
        string fingerprint = User.GetFingerprint();

        IReadOnlyList<KeyExchangeDto> keyExchanges = await mediator.Send(
            new GetKeyExchangesQuery(fingerprint, toPublicKey, fromDate, toDate),
            cancellationToken);

        return Ok(keyExchanges.Select(k => k.ToResponse()));
    }
}
