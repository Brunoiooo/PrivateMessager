using Application.Exceptions;
using Application.Interfaces;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace Infrastructure.Services;

public sealed class LoginChallengeService(MessagerDbContext dbContext) : ILoginChallengeService
{
    private static readonly TimeSpan ChallengeExpiry = TimeSpan.FromMinutes(5);

    public async Task<byte[]> CreateChallengeAsync(string fingerprintSha512, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);

        DateTime now = DateTime.UtcNow;

        List<LoginChallengeRecord> stale = await dbContext.LoginChallenges
            .Where(x => x.FingerprintSha512 == fingerprintSha512 && (x.ConsumedAt != null || x.ExpiresAt <= now))
            .ToListAsync(ct);

        if (stale.Count > 0)
            dbContext.LoginChallenges.RemoveRange(stale);

        byte[] challenge = RandomNumberGenerator.GetBytes(64);

        dbContext.LoginChallenges.Add(new LoginChallengeRecord
        {
            Id = Guid.NewGuid(),
            FingerprintSha512 = fingerprintSha512,
            Challenge = challenge,
            CreatedAt = now,
            ExpiresAt = now.Add(ChallengeExpiry)
        });

        await dbContext.SaveChangesAsync(ct);
        return challenge;
    }

    public async Task<byte[]> ConsumeValidChallengeAsync(string fingerprintSha512, byte[] challenge, CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);
        ArgumentNullException.ThrowIfNull(challenge);

        DateTime now = DateTime.UtcNow;

        LoginChallengeRecord? record = await dbContext.LoginChallenges
            .SingleOrDefaultAsync(x =>
                x.FingerprintSha512 == fingerprintSha512 &&
                x.ConsumedAt == null &&
                x.ExpiresAt > now &&
                x.Challenge == challenge,
                ct);

        if (record is null)
            throw new UnauthorizedException("Challenge is invalid or has expired.");

        record.ConsumedAt = now;
        await dbContext.SaveChangesAsync(ct);

        return record.Challenge;
    }
}
