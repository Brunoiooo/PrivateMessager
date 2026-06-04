using Api.Contracts;
using Api.Security;
using Application.Commands;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Api.Controllers;

[ApiController]
[Route("/api/auth")]
[EnableRateLimiting("auth")]
public sealed class AuthController(IMediator mediator, JwtTokenIssuer jwtTokenIssuer) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status201Created, Type = typeof(RegisterResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ErrorResponse))]
    [ProducesResponseType(StatusCodes.Status409Conflict, Type = typeof(ErrorResponse))]
    public async Task<IActionResult> RegisterAsync(
        [FromBody] RegisterRequest request,
        CancellationToken cancellationToken)
    {
        RegisterResult result = await mediator.Send(
            new RegisterCommand(request.DerBase64, request.UserName, request.UserTag),
            cancellationToken);

        return Created(
            $"/api/public-keys/{result.FingerprintSha512}",
            new RegisterResponse(result.FingerprintSha512, result.UserName, result.UserTag));
    }

    [HttpPost("challenge")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(ChallengeResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ErrorResponse))]
    [ProducesResponseType(StatusCodes.Status404NotFound, Type = typeof(ErrorResponse))]
    public async Task<IActionResult> ChallengeAsync(
        [FromBody] ChallengeRequest request,
        CancellationToken cancellationToken)
    {
        byte[] challenge = await mediator.Send(new GetLoginChallengeCommand(request.FingerprintSha512), cancellationToken);
        return Ok(new ChallengeResponse(Convert.ToBase64String(challenge)));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(StatusCodes.Status200OK, Type = typeof(LoginResponse))]
    [ProducesResponseType(StatusCodes.Status400BadRequest, Type = typeof(ErrorResponse))]
    [ProducesResponseType(StatusCodes.Status401Unauthorized, Type = typeof(ErrorResponse))]
    public async Task<IActionResult> LoginAsync(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        await mediator.Send(
            new LoginCommand(request.FingerprintSha512, request.ChallengeBase64, request.SignatureBase64),
            cancellationToken);

        (string token, DateTime expiresAtUtc) = jwtTokenIssuer.Generate(request.FingerprintSha512);
        return Ok(new LoginResponse(token, expiresAtUtc));
    }
}
