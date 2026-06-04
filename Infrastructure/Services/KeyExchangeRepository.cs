using Application.DTOs;
using Application.Interfaces;
using Domain;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Models;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public sealed class KeyExchangeRepository(MessagerDbContext dbContext) : IKeyExchangeRepository
{
    public async Task AddOrUpdateAsync(KeyExchange keyExchange, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(keyExchange);

        KeyExchangeRecord? existing = await dbContext.KeyExchanges
            .SingleOrDefaultAsync(
                x => x.FromPublicKey == keyExchange.FromPublicKey && x.ToPublicKey == keyExchange.ToPublicKey,
                ct);

        if (existing is null)
        {
            dbContext.KeyExchanges.Add(new KeyExchangeRecord
            {
                FromPublicKey = keyExchange.FromPublicKey,
                ToPublicKey = keyExchange.ToPublicKey,
                EncryptedPrivateKey = keyExchange.EncryptedPrivateKey,
                CreatedAt = keyExchange.CreatedAt
            });
        }
        else
        {
            existing.EncryptedPrivateKey = keyExchange.EncryptedPrivateKey;
            existing.CreatedAt = DateTime.UtcNow;
        }

        await dbContext.SaveChangesAsync(ct);
    }

    public Task<bool> ExistsAsync(string fromFingerprint, string toFingerprint, CancellationToken ct = default)
    {
        return dbContext.KeyExchanges
            .AnyAsync(x => x.FromPublicKey == fromFingerprint && x.ToPublicKey == toFingerprint, ct);
    }

    public async Task<IReadOnlyList<KeyExchangeDto>> GetConversationAsync(
        string userFingerprint,
        string peerFingerprint,
        DateTime? fromDate,
        DateTime? toDate,
        CancellationToken ct = default)
    {
        IQueryable<KeyExchangeRecord> query = dbContext.KeyExchanges
            .Where(x =>
                (x.FromPublicKey == userFingerprint && x.ToPublicKey == peerFingerprint) ||
                (x.FromPublicKey == peerFingerprint && x.ToPublicKey == userFingerprint));

        if (fromDate.HasValue)
            query = query.Where(x => x.CreatedAt >= fromDate.Value.ToUniversalTime());

        if (toDate.HasValue)
            query = query.Where(x => x.CreatedAt <= toDate.Value.ToUniversalTime());

        return await query
            .OrderBy(x => x.CreatedAt)
            .Select(x => new KeyExchangeDto(x.FromPublicKey, x.ToPublicKey, x.EncryptedPrivateKey, x.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<KeyExchangeDto>> GetSinceAsync(
        string userFingerprint,
        DateTime since,
        int limit,
        string? peerFilter,
        CancellationToken ct = default)
    {
        IQueryable<KeyExchangeRecord> query = dbContext.KeyExchanges
            .Where(x =>
                (x.FromPublicKey == userFingerprint || x.ToPublicKey == userFingerprint) &&
                x.CreatedAt > since);

        if (!string.IsNullOrWhiteSpace(peerFilter))
            query = query.Where(x => x.FromPublicKey == peerFilter || x.ToPublicKey == peerFilter);

        return await query
            .OrderBy(x => x.CreatedAt)
            .Take(limit)
            .Select(x => new KeyExchangeDto(x.FromPublicKey, x.ToPublicKey, x.EncryptedPrivateKey, x.CreatedAt))
            .ToListAsync(ct);
    }
}
