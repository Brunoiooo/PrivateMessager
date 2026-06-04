using Application.Commands;
using Application.Exceptions;
using Application.Interfaces;
using MediatR;

namespace Application.Handlers.Auth;

public sealed class LoginCommandHandler(ILoginService loginService) : IRequestHandler<LoginCommand>
{
    public async Task Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        byte[] challenge;
        byte[] signature;

        try
        {
            challenge = Convert.FromBase64String(request.ChallengeBase64);
            signature = Convert.FromBase64String(request.SignatureBase64);
        }
        catch (FormatException ex)
        {
            throw new ValidationException($"ChallengeBase64 or SignatureBase64 is not valid base64: {ex.Message}");
        }

        await loginService.ValidateAndConsumeAsync(
            request.FingerprintSha512,
            challenge,
            signature,
            cancellationToken);
    }
}
