using Api.Contracts;
using Application.DTOs;
using Application.Queries;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[ApiController]
[Authorize]
[Route("/api/public-keys")]
[EnableRateLimiting("search")]
public sealed class PublicKeysController(IMediator mediator) : ControllerBase
{
    [HttpGet("search")]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(IEnumerable<PublicKeyProfileResponse>))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ErrorResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> SearchAsync(
        [FromQuery] string userName,
        [FromQuery] uint? userTag,
        [FromQuery] int? limit,
        CancellationToken cancellationToken)
    {
        IReadOnlyList<PublicKeyProfileDto> results = await mediator.Send(
            new SearchPublicKeysQuery(userName, userTag, limit),
            cancellationToken);

        return Ok(results.Select(p => new PublicKeyProfileResponse(
            p.FingerprintSha512,
            p.UserName,
            p.UserTag,
            Convert.ToBase64String(p.Der))));
    }
}
