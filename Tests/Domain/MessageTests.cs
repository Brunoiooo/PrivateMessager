using Domain;

namespace Tests.DomainTests;

public sealed class MessageTests
{
    private static readonly string ValidFrom = new('a', 128);
    private static readonly string ValidTo = new('b', 128);
    private static readonly byte[] ValidContent = [1, 2, 3];
    private static readonly string ValidHash = new('c', 128);

    [Fact]
    public void Constructor_WithValidArgs_CreatesMessage()
    {
        Message msg = new(ValidFrom, ValidTo, ValidContent, ValidHash);

        Assert.Equal(ValidFrom, msg.FromPublicKey);
        Assert.Equal(ValidTo, msg.ToPublicKey);
        Assert.Equal(ValidHash, msg.MessageHash);
        Assert.True(msg.CreatedAt > DateTime.MinValue);
    }

    [Fact]
    public void Constructor_WithCustomCreatedAt_UsesProvidedTimestamp()
    {
        DateTime stamp = new(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        Message msg = new(ValidFrom, ValidTo, ValidContent, ValidHash, stamp);

        Assert.Equal(stamp, msg.CreatedAt);
    }

    [Fact]
    public void Constructor_WithSameFromAndTo_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            new Message(ValidFrom, ValidFrom, ValidContent, ValidHash));
    }

    [Fact]
    public void Constructor_WithEmptyContent_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            new Message(ValidFrom, ValidTo, [], ValidHash));
    }

    [Fact]
    public void Constructor_WithInvalidHash_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            new Message(ValidFrom, ValidTo, ValidContent, "not-128-chars"));
    }

    [Fact]
    public void Constructor_WithShortFingerprint_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            new Message("short", ValidTo, ValidContent, ValidHash));
    }
}
