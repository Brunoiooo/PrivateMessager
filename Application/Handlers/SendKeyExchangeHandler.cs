using Domain;

namespace Application;

public sealed class SendKeyExchangeHandler(ICurrentPublicKey currentPublicKey)
{
    private readonly ICurrentPublicKey _currentPublicKey = currentPublicKey;

    public KeyExchange Handle(string toPublicKey, byte[] encryptedPrivateKey)
    {
        ArgumentException.ThrowIfNullOrEmpty(toPublicKey);
        ArgumentNullException.ThrowIfNull(encryptedPrivateKey);

        return new KeyExchange(_currentPublicKey.GetFingerprintSha512(), toPublicKey, encryptedPrivateKey);
    }
}
