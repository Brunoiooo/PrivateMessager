namespace API.Contracts;

public sealed record UploadPreKeyBundleRequest(
    string IdentityKeyPublicBase64,
    int SignedPreKeyId,
    string SignedPreKeyPublicBase64,
    string SignatureBase64,
    IReadOnlyList<OneTimePreKeyEntry> OneTimePreKeys);

public sealed record OneTimePreKeyEntry(int PreKeyId, string PublicBase64);

public sealed record PreKeyBundleResponse(
    string IdentityKeyBase64,
    int SignedPreKeyId,
    string SignedPreKeyPublicBase64,
    string SignatureBase64,
    Guid? OtpId,
    string? OtpPublicBase64);
