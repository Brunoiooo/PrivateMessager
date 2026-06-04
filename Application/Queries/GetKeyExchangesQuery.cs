using Application.DTOs;
using MediatR;

namespace Application.Queries;

public sealed record GetKeyExchangesQuery(
    string CurrentUserFingerprint,
    string PeerPublicKey,
    DateTime? FromDate,
    DateTime? ToDate) : IRequest<IReadOnlyList<KeyExchangeDto>>;
