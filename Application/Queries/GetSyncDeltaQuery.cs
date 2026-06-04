using Application.DTOs;
using MediatR;

namespace Application.Queries;

public sealed record GetSyncDeltaQuery(
    string CurrentUserFingerprint,
    DateTime? Since,
    int? Limit,
    string? PeerFilter) : IRequest<SyncDeltaDto>;
