namespace Domain;

public sealed class Message : BaseEntity
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

    public byte[] EncryptedContent
    {
        get; private set;
    }

    public string MessageHash
    {
        get; private set;
    }

    public int? SignalMessageType
    {
        get; private set;
    }

    #endregion

    #region Constructors

    private Message()
    {
    }

    public Message(string fromPublicKey, string toPublicKey, byte[] encryptedContent, string messageHash, int? signalMessageType = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(fromPublicKey);
        ArgumentException.ThrowIfNullOrEmpty(toPublicKey);
        ArgumentNullException.ThrowIfNull(encryptedContent);
        ArgumentException.ThrowIfNullOrEmpty(messageHash);

        if (fromPublicKey.Length != 128)
            throw new ArgumentException("FromPublicKey must be exactly 128 characters long (hexadecimal SHA-512 hash format).", nameof(fromPublicKey));

        if (toPublicKey.Length != 128)
            throw new ArgumentException("ToPublicKey must be exactly 128 characters long (hexadecimal SHA-512 hash format).", nameof(toPublicKey));

        if (!System.Text.RegularExpressions.Regex.IsMatch(fromPublicKey, @"^[0-9a-fA-F]{128}$"))
            throw new ArgumentException("FromPublicKey must contain only hexadecimal characters (0-9, a-f, A-F).", nameof(fromPublicKey));

        if (!System.Text.RegularExpressions.Regex.IsMatch(toPublicKey, @"^[0-9a-fA-F]{128}$"))
            throw new ArgumentException("ToPublicKey must contain only hexadecimal characters (0-9, a-f, A-F).", nameof(toPublicKey));

        if (fromPublicKey == toPublicKey)
            throw new ArgumentException("FromPublicKey and ToPublicKey cannot be the same.", nameof(toPublicKey));

        if (encryptedContent.Length == 0)
            throw new ArgumentException("EncryptedContent cannot be empty.", nameof(encryptedContent));

        if (messageHash.Length != 128)
            throw new ArgumentException("MessageHash must be exactly 128 characters long (hexadecimal SHA-512 hash format).", nameof(messageHash));

        if (!System.Text.RegularExpressions.Regex.IsMatch(messageHash, @"^[0-9a-fA-F]{128}$"))
            throw new ArgumentException("MessageHash must contain only hexadecimal characters (0-9, a-f, A-F).", nameof(messageHash));

        FromPublicKey = fromPublicKey;
        ToPublicKey = toPublicKey;
        EncryptedContent = encryptedContent;
        MessageHash = messageHash;
        SignalMessageType = signalMessageType;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    #endregion
}
