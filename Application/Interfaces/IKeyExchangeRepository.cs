using Application.DTOs;
using Domain;

namespace Application.Interfaces;

public interface IKeyExchangeRepository
{
    Task AddOrUpdateAsync(KeyExchange keyExchange, CancellationToken ct = default);

    Task<bool> ExistsAsync(string fromFingerprint, string toFingerprint, CancellationToken ct = default);

    Task<IReadOnlyList<KeyExchangeDto>> GetConversationAsync(
        string userFingerprint,
        string peerFingerprint,
        DateTime? fromDate,
        DateTime? toDate,
        CancellationToken ct = default);

    Task<IReadOnlyList<KeyExchangeDto>> GetSinceAsync(
        string userFingerprint,
        DateTime since,
        int limit,
        string? peerFilter,
        CancellationToken ct = default);
}
