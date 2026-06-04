namespace Domain;

public sealed class KeyExchange : BaseEntity
{
    public string FromPublicKey { get; private set; } = string.Empty;
    public string ToPublicKey { get; private set; } = string.Empty;
    public byte[] EncryptedPrivateKey { get; private set; } = [];

    private KeyExchange() { }

    public KeyExchange(string fromPublicKey, string toPublicKey, byte[] encryptedPrivateKey, DateTime? createdAt = null)
    {
        Fingerprint.Validate(fromPublicKey, nameof(fromPublicKey));
        Fingerprint.Validate(toPublicKey, nameof(toPublicKey));

        if (fromPublicKey.Equals(toPublicKey, StringComparison.Ordinal))
            throw new ArgumentException("FromPublicKey and ToPublicKey cannot be the same.", nameof(toPublicKey));

        ArgumentNullException.ThrowIfNull(encryptedPrivateKey);
        if (encryptedPrivateKey.Length == 0)
            throw new ArgumentException("EncryptedPrivateKey cannot be empty.", nameof(encryptedPrivateKey));

        FromPublicKey = fromPublicKey;
        ToPublicKey = toPublicKey;
        EncryptedPrivateKey = encryptedPrivateKey;
        CreatedAt = createdAt?.ToUniversalTime() ?? DateTime.UtcNow;
    }
}
