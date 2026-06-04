using Application.DTOs;
using MediatR;

namespace Application.Queries;

public sealed record GetMessagesQuery(
    string CurrentUserFingerprint,
    string PeerPublicKey,
    DateTime? FromDate,
    DateTime? ToDate) : IRequest<IReadOnlyList<MessageDto>>;
