namespace Application.DTOs;

public sealed record MessageDto(
    string FromPublicKey,
    string ToPublicKey,
    byte[] EncryptedContent,
    string MessageHash,
    DateTime CreatedAt);
