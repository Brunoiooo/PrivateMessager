using Application;
using Domain;
using Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace Infrastructure.Services;

public sealed class PublicKeyRepository(MessagerDbContext dbContext) : IPublicKeyRepository
{
    private static readonly FieldInfo YourMessagesField =
        typeof(PublicKey).GetField("_yourMessages", BindingFlags.Instance | BindingFlags.NonPublic)
        ?? throw new MissingFieldException(typeof(PublicKey).FullName, "_yourMessages");

    private static readonly FieldInfo YourKeyExchangesField =
        typeof(PublicKey).GetField("_yourKeyExchanges", BindingFlags.Instance | BindingFlags.NonPublic)
        ?? throw new MissingFieldException(typeof(PublicKey).FullName, "_yourKeyExchanges");

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

        List<KeyExchange> yourKeyExchanges = (List<KeyExchange>)YourKeyExchangesField.GetValue(publicKey)!;
        foreach (Persistence.Models.KeyExchangeRecord keyExchange in receivedKeyExchanges)
            yourKeyExchanges.Add(new KeyExchange(keyExchange.FromPublicKey, keyExchange.ToPublicKey, keyExchange.EncryptedPrivateKey));

        List<Persistence.Models.MessageRecord> sentMessages = _dbContext.Messages
            .Where(x => x.FromPublicKey == fingerprintSha512)
            .ToList();

        foreach (Persistence.Models.MessageRecord message in sentMessages)
            publicKey.SendMessage(message.ToPublicKey, message.EncryptedContent, message.MessageHash, message.SignalMessageType);

        List<Persistence.Models.MessageRecord> receivedMessages = _dbContext.Messages
            .Where(x => x.ToPublicKey == fingerprintSha512)
            .ToList();

        List<Message> yourMessages = (List<Message>)YourMessagesField.GetValue(publicKey)!;
        foreach (Persistence.Models.MessageRecord message in receivedMessages)
            yourMessages.Add(new Message(message.FromPublicKey, message.ToPublicKey, message.EncryptedContent, message.MessageHash, message.SignalMessageType));

        return publicKey;
    }
}
