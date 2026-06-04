namespace Application.DTOs;

public sealed record PublicKeyProfileDto(
    string FingerprintSha512,
    string UserName,
    uint UserTag,
    byte[] Der);
