namespace Domain;

public sealed class Message : BaseEntity
{
    public string FromPublicKey { get; private set; } = string.Empty;
    public string ToPublicKey { get; private set; } = string.Empty;
    public byte[] EncryptedContent { get; private set; } = [];
    public string MessageHash { get; private set; } = string.Empty;

    private Message() { }

    public Message(string fromPublicKey, string toPublicKey, byte[] encryptedContent, string messageHash, DateTime? createdAt = null)
    {
        Fingerprint.Validate(fromPublicKey, nameof(fromPublicKey));
        Fingerprint.Validate(toPublicKey, nameof(toPublicKey));

        if (fromPublicKey.Equals(toPublicKey, StringComparison.Ordinal))
            throw new ArgumentException("FromPublicKey and ToPublicKey cannot be the same.", nameof(toPublicKey));

        ArgumentNullException.ThrowIfNull(encryptedContent);
        if (encryptedContent.Length == 0)
            throw new ArgumentException("EncryptedContent cannot be empty.", nameof(encryptedContent));

        Fingerprint.Validate(messageHash, nameof(messageHash));

        FromPublicKey = fromPublicKey;
        ToPublicKey = toPublicKey;
        EncryptedContent = encryptedContent;
        MessageHash = messageHash;
        CreatedAt = createdAt?.ToUniversalTime() ?? DateTime.UtcNow;
    }
}
