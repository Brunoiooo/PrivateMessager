using Application;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services;

public sealed class PublicKeyRepository(MessagerDbContext dbContext) : IPublicKeyRepository
{
    private readonly MessagerDbContext _dbContext = dbContext;

    public PublicKey GetRequired(string fingerprintSha512)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);

        Persistence.Models.PublicKeyRecord record = _dbContext.PublicKeys
            .SingleOrDefault(x => x.FingerprintSha512 == fingerprintSha512)
            ?? throw new InvalidOperationException("Public key not found.");

        PublicKey publicKey = new(record.Der, record.FingerprintSha512, record.UserName, record.UserTag);

        List<Persistence.Models.KeyExchangeRecord> sentKeyExchanges = _dbContext.KeyExchanges
            .Where(x => x.FromPublicKey == fingerprintSha512)
            .ToList();

        foreach (Persistence.Models.KeyExchangeRecord keyExchange in sentKeyExchanges)
            publicKey.AddKeyExchange(keyExchange.ToPublicKey, keyExchange.EncryptedPrivateKey);

        List<Persistence.Models.KeyExchangeRecord> receivedKeyExchanges = _dbContext.KeyExchanges
            .Where(x => x.ToPublicKey == fingerprintSha512)
            .ToList();

        foreach (Persistence.Models.KeyExchangeRecord keyExchange in receivedKeyExchanges)
            publicKey.AddReceivedKeyExchange(keyExchange.FromPublicKey, keyExchange.ToPublicKey, keyExchange.EncryptedPrivateKey);

        List<Persistence.Models.MessageRecord> sentMessages = _dbContext.Messages
            .Where(x => x.FromPublicKey == fingerprintSha512)
            .ToList();

        foreach (Persistence.Models.MessageRecord message in sentMessages)
            publicKey.SendMessage(message.ToPublicKey, message.EncryptedContent, message.MessageHash, message.SignalMessageType);

        List<Persistence.Models.MessageRecord> receivedMessages = _dbContext.Messages
            .Where(x => x.ToPublicKey == fingerprintSha512)
            .ToList();

        foreach (Persistence.Models.MessageRecord message in receivedMessages)
            publicKey.AddReceivedMessage(message.FromPublicKey, message.ToPublicKey, message.EncryptedContent, message.MessageHash, message.SignalMessageType);

        return publicKey;
    }
}
