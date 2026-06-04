using Application.DTOs;
using Application.Interfaces;
using Application.Queries;
using MediatR;

namespace Application.Handlers.KeyExchanges;

public sealed class GetKeyExchangesQueryHandler(IKeyExchangeRepository keyExchangeRepository)
    : IRequestHandler<GetKeyExchangesQuery, IReadOnlyList<KeyExchangeDto>>
{
    public Task<IReadOnlyList<KeyExchangeDto>> Handle(GetKeyExchangesQuery request, CancellationToken cancellationToken) =>
        keyExchangeRepository.GetConversationAsync(
            request.CurrentUserFingerprint,
            request.PeerPublicKey,
            request.FromDate,
            request.ToDate,
            cancellationToken);
}
