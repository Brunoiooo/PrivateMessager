using Application.Commands;
using Application.Exceptions;
using Application.Interfaces;
using MediatR;

namespace Application.Handlers.Auth;

public sealed class GetLoginChallengeCommandHandler(
    IPublicKeyRepository publicKeyRepository,
    ILoginChallengeService loginChallengeService) : IRequestHandler<GetLoginChallengeCommand, byte[]>
{
    public async Task<byte[]> Handle(GetLoginChallengeCommand request, CancellationToken cancellationToken)
    {
        bool exists = await publicKeyRepository.ExistsAsync(request.FingerprintSha512, cancellationToken);
        if (!exists)
            throw new NotFoundException($"Public key '{request.FingerprintSha512[..8]}...' not found.");

        return await loginChallengeService.CreateChallengeAsync(request.FingerprintSha512, cancellationToken);
    }
}
