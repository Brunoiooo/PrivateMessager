using Application.Exceptions;
using Application.Interfaces;
using Domain;
using System.Security.Cryptography;

namespace Infrastructure.Services;

public sealed class LoginService(
    IPublicKeyRepository publicKeyRepository,
    ILoginChallengeService loginChallengeService) : ILoginService
{
    public async Task ValidateAndConsumeAsync(
        string fingerprintSha512,
        byte[] challenge,
        byte[] signature,
        CancellationToken ct = default)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);
        ArgumentNullException.ThrowIfNull(challenge);
        ArgumentNullException.ThrowIfNull(signature);

        PublicKey? publicKey = await publicKeyRepository.FindAsync(fingerprintSha512, ct);
        if (publicKey is null)
            throw new NotFoundException($"Public key '{fingerprintSha512[..8]}...' not found.");

        await loginChallengeService.ConsumeValidChallengeAsync(fingerprintSha512, challenge, ct);

        VerifySignature(publicKey.Der, challenge, signature);
    }

    private static void VerifySignature(byte[] der, byte[] challenge, byte[] signature)
    {
        using RSA rsa = RSA.Create();

        try
        {
            rsa.ImportSubjectPublicKeyInfo(der, out _);
        }
        catch (CryptographicException)
        {
            rsa.ImportRSAPublicKey(der, out _);
        }

        bool valid = rsa.VerifyData(challenge, signature, HashAlgorithmName.SHA512, RSASignaturePadding.Pkcs1);
        if (!valid)
            throw new UnauthorizedException("Signature verification failed.");
    }
}
