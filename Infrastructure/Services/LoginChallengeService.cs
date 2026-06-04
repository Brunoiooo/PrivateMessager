using Application;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace Infrastructure.Services;

public sealed class LoginChallengeService(MessagerDbContext dbContext) : ILoginChallengeService
{
    private readonly MessagerDbContext _dbContext = dbContext;

    public byte[] GetChallenge(string fingerprintSha512)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);

        bool exists = _dbContext.PublicKeys.Any(x => x.FingerprintSha512 == fingerprintSha512);
        if (!exists)
            throw new InvalidOperationException("Public key does not exist.");

        DateTime now = DateTime.UtcNow;

        List<LoginChallengeRecord> expiredChallenges = _dbContext.LoginChallenges
            .Where(x => x.FingerprintSha512 == fingerprintSha512 && (x.ConsumedAt != null || x.ExpiresAt <= now))
            .ToList();

        if (expiredChallenges.Count > 0)
            _dbContext.LoginChallenges.RemoveRange(expiredChallenges);

        byte[] challenge = RandomNumberGenerator.GetBytes(64);

        _dbContext.LoginChallenges.Add(new LoginChallengeRecord
        {
            Id = Guid.NewGuid(),
            FingerprintSha512 = fingerprintSha512,
            Challenge = challenge,
            CreatedAt = now,
            ExpiresAt = now.AddMinutes(5)
        });

        _dbContext.SaveChanges();
        return challenge;
    }
}
