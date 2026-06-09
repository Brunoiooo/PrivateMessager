namespace Domain;

public sealed class PublicKey : BaseEntity
{
    #region Properties

    public string FingerprintSha512
    {
        get; private set;
    }

    public byte[] Der
    {
        get; private set;
    }

    public string UserName
    {
        get; private set;
    }

    public uint UserTag
    {
        get; private set;
    }

    private List<KeyExchange> _myKeyExchanges = [];

    public IReadOnlyList<KeyExchange> MyKeyExchanges => _myKeyExchanges.AsReadOnly();

    private List<KeyExchange> _yourKeyExchanges = [];

    public IReadOnlyList<KeyExchange> YourKeyExchanges => _yourKeyExchanges.AsReadOnly();

    private List<Message> _myMessages = [];

    public IReadOnlyList<Message> MyMessages => _myMessages.AsReadOnly();

    private List<Message> _yourMessages = [];

    public IReadOnlyList<Message> YourMessages => _yourMessages.AsReadOnly();

    #endregion

    #region Constructors

    private PublicKey()
    {
    }

    public PublicKey(byte[] der,
        string fingerprintSha512,
        string userName,
        uint userTag)
    {
        ArgumentNullException.ThrowIfNull(der);
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);
        ArgumentException.ThrowIfNullOrEmpty(userName);

        if (der.Length == 0)
            throw new ArgumentException("DER public key cannot be empty.", nameof(der));

        if (fingerprintSha512.Length != 128)
            throw new ArgumentException("SHA-512 fingerprint must be exactly 128 characters long (hexadecimal format).", nameof(fingerprintSha512));

        if (!System.Text.RegularExpressions.Regex.IsMatch(fingerprintSha512, @"^[0-9a-fA-F]{128}$"))
            throw new ArgumentException("SHA-512 fingerprint must contain only hexadecimal characters (0-9, a-f, A-F).", nameof(fingerprintSha512));

        if (userName.Length < 3 || userName.Length > 32)
            throw new ArgumentException("UserName must be between 3 and 32 characters long.", nameof(userName));

        if (!System.Text.RegularExpressions.Regex.IsMatch(userName, @"^[a-zA-Z0-9_-]+$"))
            throw new ArgumentException("UserName can only contain alphanumeric characters, underscores, and hyphens.", nameof(userName));

        if (userTag == 0)
            throw new ArgumentException("UserTag must be greater than 0.", nameof(userTag));

        if (userTag > 99999)
            throw new ArgumentException("UserTag must be less than or equal to 99999.", nameof(userTag));

        Der = der;
        FingerprintSha512 = fingerprintSha512;
        UserName = userName;
        UserTag = userTag;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    #endregion

    #region Methods

    public void AddKeyExchange(string toPublicKey, byte[] encryptedPrivateKey) =>
        _myKeyExchanges.Add(new(FingerprintSha512, toPublicKey, encryptedPrivateKey));

    public Message SendMessage(string toPublicKey, byte[] encryptedContent, string messageHash, int? signalMessageType = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(toPublicKey);

        bool hasKeyExchangeForRecipient = _myKeyExchanges.Any(x => x.ToPublicKey == toPublicKey);
        if (!hasKeyExchangeForRecipient)
            throw new InvalidOperationException("Cannot send message without a key exchange from owner to recipient.");

        Message message = new(FingerprintSha512, toPublicKey, encryptedContent, messageHash, signalMessageType);
        _myMessages.Add(message);
        return message;
    }

    public IReadOnlyList<Message> GetMessages(
        string toPublicKey,
        DateTime? fromDate = null,
        DateTime? toDate = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(toPublicKey);

        if (fromDate.HasValue && toDate.HasValue && fromDate.Value > toDate.Value)
            throw new ArgumentException("fromDate cannot be greater than toDate.", nameof(fromDate));

        IEnumerable<Message> messages = _myMessages
            .Concat(_yourMessages)
            .Where(message => message.FromPublicKey == toPublicKey || message.ToPublicKey == toPublicKey);

        if (fromDate.HasValue)
            messages = messages.Where(message => message.CreatedAt >= fromDate.Value);

        if (toDate.HasValue)
            messages = messages.Where(message => message.CreatedAt <= toDate.Value);

        return messages
            .OrderBy(message => message.CreatedAt)
            .ToList();
    }

    public IReadOnlyList<KeyExchange> GetKeyExchanges(
        string toPublicKey,
        DateTime? fromDate = null,
        DateTime? toDate = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(toPublicKey);

        if (fromDate.HasValue && toDate.HasValue && fromDate.Value > toDate.Value)
            throw new ArgumentException("fromDate cannot be greater than toDate.", nameof(fromDate));

        IEnumerable<KeyExchange> keyExchanges = _myKeyExchanges
            .Concat(_yourKeyExchanges)
            .Where(keyExchange => keyExchange.FromPublicKey == toPublicKey || keyExchange.ToPublicKey == toPublicKey);

        if (fromDate.HasValue)
            keyExchanges = keyExchanges.Where(keyExchange => keyExchange.CreatedAt >= fromDate.Value);

        if (toDate.HasValue)
            keyExchanges = keyExchanges.Where(keyExchange => keyExchange.CreatedAt <= toDate.Value);

        return keyExchanges
            .OrderBy(keyExchange => keyExchange.CreatedAt)
            .ToList();
    }

    #endregion
}
