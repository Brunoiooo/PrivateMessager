using MediatR;

namespace Application.Commands;

public sealed record RegisterCommand(string DerBase64, string UserName, uint UserTag)
    : IRequest<RegisterResult>;

public sealed record RegisterResult(string FingerprintSha512, string UserName, uint UserTag);
