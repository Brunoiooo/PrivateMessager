namespace Api.Contracts;

public sealed record SendKeyExchangeRequest(string ToPublicKey, string EncryptedPrivateKeyBase64);
public sealed record KeyExchangeResponse(string FromPublicKey, string ToPublicKey, string EncryptedPrivateKeyBase64, DateTime CreatedAt);
