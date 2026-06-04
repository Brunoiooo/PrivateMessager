using MediatR;

namespace Application.Commands;

public sealed record GetLoginChallengeCommand(string FingerprintSha512)
    : IRequest<byte[]>;
