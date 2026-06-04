namespace Application.DTOs;

public sealed record KeyExchangeDto(
    string FromPublicKey,
    string ToPublicKey,
    byte[] EncryptedPrivateKey,
    DateTime CreatedAt);
