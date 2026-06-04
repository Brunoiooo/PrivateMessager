using Application.DTOs;
using Application.Interfaces;
using Domain;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Models;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public sealed class PublicKeyRepository(MessagerDbContext dbContext) : IPublicKeyRepository
{
    public async Task<PublicKey?> FindAsync(string fingerprintSha512, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);

        PublicKeyRecord? record = await dbContext.PublicKeys
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.FingerprintSha512 == fingerprintSha512, ct);

        return record is null ? null : new PublicKey(record.Der, record.FingerprintSha512, record.UserName, record.UserTag);
    }

    public Task<bool> ExistsAsync(string fingerprintSha512, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);
        return dbContext.PublicKeys.AnyAsync(x => x.FingerprintSha512 == fingerprintSha512, ct);
    }

    public async Task AddAsync(PublicKey publicKey, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(publicKey);

        DateTime now = DateTime.UtcNow;
        dbContext.PublicKeys.Add(new PublicKeyRecord
        {
            FingerprintSha512 = publicKey.FingerprintSha512,
            Der = publicKey.Der,
            UserName = publicKey.UserName,
            UserTag = publicKey.UserTag,
            CreatedAt = now,
            UpdatedAt = now
        });

        await dbContext.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<PublicKeyProfileDto>> SearchAsync(string userNamePattern, uint? userTag, int limit, CancellationToken ct = default)
    {
        IQueryable<PublicKeyRecord> query = dbContext.PublicKeys
            .Where(x => EF.Functions.ILike(x.UserName, $"%{userNamePattern}%", "\\"));

        if (userTag.HasValue)
            query = query.Where(x => x.UserTag == userTag.Value);

        return await query
            .OrderBy(x => x.UserName)
            .ThenBy(x => x.UserTag)
            .ThenBy(x => x.FingerprintSha512)
            .Take(limit)
            .Select(x => new PublicKeyProfileDto(x.FingerprintSha512, x.UserName, x.UserTag, x.Der))
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<PublicKeyProfileDto>> GetByFingerprintsAsync(IEnumerable<string> fingerprints, CancellationToken ct = default)
    {
        List<string> fingerprintList = fingerprints.Distinct().ToList();

        return await dbContext.PublicKeys
            .Where(x => fingerprintList.Contains(x.FingerprintSha512))
            .Select(x => new PublicKeyProfileDto(x.FingerprintSha512, x.UserName, x.UserTag, x.Der))
            .ToListAsync(ct);
    }
}
