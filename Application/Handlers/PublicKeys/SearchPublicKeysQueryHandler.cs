using Application.DTOs;
using Application.Exceptions;
using Application.Interfaces;
using Application.Queries;
using MediatR;

namespace Application.Handlers.PublicKeys;

public sealed class SearchPublicKeysQueryHandler(IPublicKeyRepository publicKeyRepository)
    : IRequestHandler<SearchPublicKeysQuery, IReadOnlyList<PublicKeyProfileDto>>
{
    private const int DefaultLimit = 25;
    private const int MaxLimit = 100;

    public async Task<IReadOnlyList<PublicKeyProfileDto>> Handle(SearchPublicKeysQuery request, CancellationToken cancellationToken)
    {
        string normalized = request.UserName.Trim();
        if (normalized.Length < 2)
            throw new ValidationException("UserName must have at least 2 characters.");

        int limit = Math.Clamp(request.Limit ?? DefaultLimit, 1, MaxLimit);

        string escaped = normalized
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");

        return await publicKeyRepository.SearchAsync(escaped, request.UserTag, limit, cancellationToken);
    }
}
