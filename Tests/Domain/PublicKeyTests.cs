using Domain;

namespace Tests.DomainTests;

public sealed class PublicKeyTests
{
    private static readonly byte[] ValidDer = new byte[256];
    private static readonly string ValidFingerprint = new string('a', 128);
    private const string ValidUserName = "TestUser";
    private const uint ValidTag = 1234;

    [Fact]
    public void Constructor_WithValidArgs_CreatesPublicKey()
    {
        PublicKey pk = new(ValidDer, ValidFingerprint, ValidUserName, ValidTag);

        Assert.Equal(ValidFingerprint, pk.FingerprintSha512);
        Assert.Equal(ValidUserName, pk.UserName);
        Assert.Equal(ValidTag, pk.UserTag);
        Assert.True(pk.CreatedAt > DateTime.MinValue);
    }

    [Fact]
    public void Constructor_WithEmptyDer_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            new PublicKey([], ValidFingerprint, ValidUserName, ValidTag));
    }

    [Theory]
    [InlineData("ab")]
    [InlineData("")]
    [InlineData("xy")]
    public void Constructor_WithShortUserName_Throws(string name)
    {
        Assert.Throws<ArgumentException>(() =>
            new PublicKey(ValidDer, ValidFingerprint, name, ValidTag));
    }

    [Fact]
    public void Constructor_WithUserNameTooLong_Throws()
    {
        string longName = new('a', 33);
        Assert.Throws<ArgumentException>(() =>
            new PublicKey(ValidDer, ValidFingerprint, longName, ValidTag));
    }

    [Fact]
    public void Constructor_WithUserNameContainingSpaces_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            new PublicKey(ValidDer, ValidFingerprint, "user name", ValidTag));
    }

    [Theory]
    [InlineData(0u)]
    [InlineData(100000u)]
    public void Constructor_WithInvalidTag_Throws(uint tag)
    {
        Assert.Throws<ArgumentException>(() =>
            new PublicKey(ValidDer, ValidFingerprint, ValidUserName, tag));
    }

    [Fact]
    public void Constructor_WithFingerprintNot128Chars_Throws()
    {
        Assert.Throws<ArgumentException>(() =>
            new PublicKey(ValidDer, "short", ValidUserName, ValidTag));
    }

    [Fact]
    public void Constructor_WithNonHexFingerprint_Throws()
    {
        string nonHex = new('z', 128);
        Assert.Throws<ArgumentException>(() =>
            new PublicKey(ValidDer, nonHex, ValidUserName, ValidTag));
    }
}
