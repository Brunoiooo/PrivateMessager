using Application.DTOs;
using Application.Interfaces;
using Domain;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Models;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public sealed class MessageRepository(MessagerDbContext dbContext) : IMessageRepository
{
    public async Task AddAsync(Message message, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(message);

        dbContext.Messages.Add(new MessageRecord
        {
            FromPublicKey = message.FromPublicKey,
            ToPublicKey = message.ToPublicKey,
            EncryptedContent = message.EncryptedContent,
            MessageHash = message.MessageHash,
            CreatedAt = message.CreatedAt
        });

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<MessageDto>> GetConversationAsync(
        string userFingerprint,
        string peerFingerprint,
        DateTime? fromDate,
        DateTime? toDate,
        CancellationToken ct = default)
    {
        IQueryable<MessageRecord> query = dbContext.Messages
            .Where(x =>
                (x.FromPublicKey == userFingerprint && x.ToPublicKey == peerFingerprint) ||
                (x.FromPublicKey == peerFingerprint && x.ToPublicKey == userFingerprint));

        if (fromDate.HasValue)
            query = query.Where(x => x.CreatedAt >= fromDate.Value.ToUniversalTime());

        if (toDate.HasValue)
            query = query.Where(x => x.CreatedAt <= toDate.Value.ToUniversalTime());

        return await query
            .OrderBy(x => x.CreatedAt)
            .Select(x => new MessageDto(x.FromPublicKey, x.ToPublicKey, x.EncryptedContent, x.MessageHash, x.CreatedAt))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<MessageDto>> GetSinceAsync(
        string userFingerprint,
        DateTime since,
        int limit,
        string? peerFilter,
        CancellationToken ct = default)
    {
        IQueryable<MessageRecord> query = dbContext.Messages
            .Where(x =>
                (x.FromPublicKey == userFingerprint || x.ToPublicKey == userFingerprint) &&
                x.CreatedAt > since);

        if (!string.IsNullOrWhiteSpace(peerFilter))
            query = query.Where(x => x.FromPublicKey == peerFilter || x.ToPublicKey == peerFilter);

        return await query
            .OrderBy(x => x.CreatedAt)
            .Take(limit)
            .Select(x => new MessageDto(x.FromPublicKey, x.ToPublicKey, x.EncryptedContent, x.MessageHash, x.CreatedAt))
            .ToListAsync(ct);
    }
}
