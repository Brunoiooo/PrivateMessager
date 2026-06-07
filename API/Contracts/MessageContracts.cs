namespace API.Contracts;

public sealed record SendMessageRequest(string ToPublicKey, string EncryptedContentBase64, string MessageHash, int? SignalMessageType = null);
public sealed record MessageResponse(string FromPublicKey, string ToPublicKey, string EncryptedContentBase64, string MessageHash, DateTime CreatedAt, int? SignalMessageType = null);
