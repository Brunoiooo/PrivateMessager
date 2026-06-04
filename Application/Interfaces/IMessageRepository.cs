using Application.DTOs;
using Domain;

namespace Application.Interfaces;

public interface IMessageRepository
{
    Task AddAsync(Message message, CancellationToken ct = default);

    Task<IReadOnlyList<MessageDto>> GetConversationAsync(
        string userFingerprint,
        string peerFingerprint,
        DateTime? fromDate,
        DateTime? toDate,
        CancellationToken ct = default);

    Task<IReadOnlyList<MessageDto>> GetSinceAsync(
        string userFingerprint,
        DateTime since,
        int limit,
        string? peerFilter,
        CancellationToken ct = default);
}
