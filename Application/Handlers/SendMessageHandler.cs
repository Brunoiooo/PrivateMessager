using Domain;

namespace Application;

public sealed class SendMessageHandler(ICurrentPublicKey currentPublicKey)
{
    private readonly ICurrentPublicKey _currentPublicKey = currentPublicKey;

    public Message Handle(string toPublicKey, byte[] encryptedContent, string messageHash, int? signalMessageType = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(toPublicKey);
        ArgumentNullException.ThrowIfNull(encryptedContent);
        ArgumentException.ThrowIfNullOrEmpty(messageHash);

        return new Message(
            _currentPublicKey.GetFingerprintSha512(),
             toPublicKey,
             encryptedContent,
            messageHash,
            signalMessageType
        );
    }
}
