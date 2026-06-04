namespace Domain;

public sealed class KeyExchange : BaseEntity
{
    #region Properties

    public string FromPublicKey
    {
        get; private set;
    }

    public string ToPublicKey
    {
        get; private set;
    }

    public byte[] EncryptedPrivateKey
    {
        get; private set;
    }

    #endregion

    #region Constructors

    private KeyExchange()
    {
    }

    public KeyExchange(string fromPublicKey, string toPublicKey, byte[] encryptedPrivateKey)
    {
        ArgumentException.ThrowIfNullOrEmpty(fromPublicKey);
        ArgumentException.ThrowIfNullOrEmpty(toPublicKey);

        if (fromPublicKey.Length != 128)
            throw new ArgumentException("FromPublicKey must be exactly 128 characters long (hexadecimal SHA-512 hash format).", nameof(fromPublicKey));

        if (toPublicKey.Length != 128)
            throw new ArgumentException("ToPublicKey must be exactly 128 characters long (hexadecimal SHA-512 hash format).", nameof(toPublicKey));

        if (fromPublicKey == toPublicKey)
            throw new ArgumentException("FromPublicKey and ToPublicKey cannot be the same.", nameof(toPublicKey));

        ArgumentNullException.ThrowIfNull(encryptedPrivateKey);

        if (encryptedPrivateKey.Length == 0)
            throw new ArgumentException("EncryptedPrivateKey cannot be empty.", nameof(encryptedPrivateKey));

        FromPublicKey = fromPublicKey;
        ToPublicKey = toPublicKey;
        EncryptedPrivateKey = encryptedPrivateKey;
    }

    #endregion
}
