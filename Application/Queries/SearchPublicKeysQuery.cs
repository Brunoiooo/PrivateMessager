using Application.DTOs;
using MediatR;

namespace Application.Queries;

public sealed record SearchPublicKeysQuery(string UserName, uint? UserTag, int? Limit)
    : IRequest<IReadOnlyList<PublicKeyProfileDto>>;
