using Application.Commands;
using Application.DTOs;
using Application.Exceptions;
using Application.Interfaces;
using Domain;
using MediatR;

namespace Application.Handlers.KeyExchanges;

public sealed class SendKeyExchangeCommandHandler(
    IKeyExchangeRepository keyExchangeRepository,
    ISyncNotifier syncNotifier) : IRequestHandler<SendKeyExchangeCommand, KeyExchangeDto>
{
    public async Task<KeyExchangeDto> Handle(SendKeyExchangeCommand request, CancellationToken cancellationToken)
    {
        byte[] encryptedPrivateKey;
        try
        {
            encryptedPrivateKey = Convert.FromBase64String(request.EncryptedPrivateKeyBase64);
        }
        catch (FormatException ex)
        {
            throw new ValidationException($"EncryptedPrivateKeyBase64 is not valid base64: {ex.Message}");
        }

        KeyExchange keyExchange = new(request.CurrentUserFingerprint, request.ToPublicKey, encryptedPrivateKey);
        await keyExchangeRepository.AddOrUpdateAsync(keyExchange, cancellationToken);

        syncNotifier.NotifyKeyExchange(keyExchange.FromPublicKey, keyExchange.ToPublicKey);

        return new KeyExchangeDto(
            keyExchange.FromPublicKey,
            keyExchange.ToPublicKey,
            keyExchange.EncryptedPrivateKey,
            keyExchange.CreatedAt);
    }
}
