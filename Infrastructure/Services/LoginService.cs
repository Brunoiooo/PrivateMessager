using Application;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography;

namespace Infrastructure.Services;

public sealed class LoginService(MessagerDbContext dbContext) : ILoginService
{
    private readonly MessagerDbContext _dbContext = dbContext;

    public string Login(string fingerprintSha512, byte[] challenge, byte[] signature)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);
        ArgumentNullException.ThrowIfNull(challenge);
        ArgumentNullException.ThrowIfNull(signature);

        DateTime now = DateTime.UtcNow;

        Domain.PublicKey publicKey = new PublicKeyRepository(_dbContext).GetRequired(fingerprintSha512);

        Infrastructure.Persistence.Models.LoginChallengeRecord challengeRecord = _dbContext.LoginChallenges
            .SingleOrDefault(x =>
                x.FingerprintSha512 == fingerprintSha512 &&
                x.ConsumedAt == null &&
                x.ExpiresAt > now &&
                x.Challenge == challenge)
            ?? throw new InvalidOperationException("Challenge is invalid or expired.");

        using RSA rsa = RSA.Create();

        try
        {
            rsa.ImportSubjectPublicKeyInfo(publicKey.Der, out _);
        }
        catch (CryptographicException)
        {
            rsa.ImportRSAPublicKey(publicKey.Der, out _);
        }

        bool verified = rsa.VerifyData(challenge, signature, HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1);
        if (!verified)
            throw new InvalidOperationException("Invalid signature.");

        challengeRecord.ConsumedAt = now;
        _dbContext.SaveChanges();

        return fingerprintSha512;
    }
}
