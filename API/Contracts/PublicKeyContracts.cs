namespace Api.Contracts;

public sealed record PublicKeyProfileResponse(string FingerprintSha512, string UserName, uint UserTag, string PublicKeyDerBase64);
