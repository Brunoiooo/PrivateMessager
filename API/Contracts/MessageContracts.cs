namespace Api.Contracts;

public sealed record SendMessageRequest(string ToPublicKey, string EncryptedContentBase64, string MessageHash);
public sealed record MessageResponse(string FromPublicKey, string ToPublicKey, string EncryptedContentBase64, string MessageHash, DateTime CreatedAt);
