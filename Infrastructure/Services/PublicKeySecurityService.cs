using Application.Interfaces;
using System.Security.Cryptography;

namespace Infrastructure.Services;

public sealed class PublicKeySecurityService : IPublicKeySecurityService
{
    public void EnsureValidRsaPublicKey(byte[] der)
    {
        ArgumentNullException.ThrowIfNull(der);

        using RSA rsa = RSA.Create();

        try
        {
            rsa.ImportSubjectPublicKeyInfo(der, out _);
            return;
        }
        catch (CryptographicException) { }

        try
        {
            rsa.ImportRSAPublicKey(der, out _);
        }
        catch (CryptographicException ex)
        {
            throw new ArgumentException("Invalid RSA public key format.", nameof(der), ex);
        }
    }

    public string ComputeFingerprintSha512(byte[] der)
    {
        ArgumentNullException.ThrowIfNull(der);
        return Convert.ToHexString(SHA512.HashData(der)).ToLowerInvariant();
    }
}
