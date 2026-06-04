using System.Security.Cryptography;
using Application;

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
        }
        catch (CryptographicException)
        {
            try
            {
                rsa.ImportRSAPublicKey(der, out _);
            }
            catch (CryptographicException ex)
            {
                throw new ArgumentException("Invalid RSA public key format.", nameof(der), ex);
            }
        }
    }

    public string ComputeFingerprintSha512(byte[] der)
    {
        ArgumentNullException.ThrowIfNull(der);

        byte[] hash = SHA512.HashData(der);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
