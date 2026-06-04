using System.Text.RegularExpressions;

namespace Domain;

public sealed class PublicKey : BaseEntity
{
    public string FingerprintSha512 { get; private set; } = string.Empty;
    public byte[] Der { get; private set; } = [];
    public string UserName { get; private set; } = string.Empty;
    public uint UserTag { get; private set; }

    private static readonly Regex UserNamePattern =
        new(@"^[a-zA-Z0-9_-]+$", RegexOptions.Compiled);

    private PublicKey() { }

    public PublicKey(byte[] der, string fingerprintSha512, string userName, uint userTag)
    {
        ArgumentNullException.ThrowIfNull(der);
        if (der.Length == 0)
            throw new ArgumentException("DER public key cannot be empty.", nameof(der));

        Fingerprint.Validate(fingerprintSha512, nameof(fingerprintSha512));

        if (userName.Length < 3 || userName.Length > 32)
            throw new ArgumentException("UserName must be between 3 and 32 characters long.", nameof(userName));

        if (!UserNamePattern.IsMatch(userName))
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
    }
}
