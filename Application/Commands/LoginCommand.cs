using MediatR;

namespace Application.Commands;

public sealed record LoginCommand(string FingerprintSha512, string ChallengeBase64, string SignatureBase64)
    : IRequest;
