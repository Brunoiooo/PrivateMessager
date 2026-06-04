using Application.Commands;
using Application.DTOs;
using Application.Exceptions;
using Application.Interfaces;
using Domain;
using MediatR;

namespace Application.Handlers.Messages;

public sealed class SendMessageCommandHandler(
    IKeyExchangeRepository keyExchangeRepository,
    IMessageRepository messageRepository,
    ISyncNotifier syncNotifier) : IRequestHandler<SendMessageCommand, MessageDto>
{
    public async Task<MessageDto> Handle(SendMessageCommand request, CancellationToken cancellationToken)
    {
        byte[] encryptedContent;
        try
        {
            encryptedContent = Convert.FromBase64String(request.EncryptedContentBase64);
        }
        catch (FormatException ex)
        {
            throw new ValidationException($"EncryptedContentBase64 is not valid base64: {ex.Message}");
        }

        bool hasKeyExchange = await keyExchangeRepository.ExistsAsync(
            request.CurrentUserFingerprint,
            request.ToPublicKey,
            cancellationToken);

        if (!hasKeyExchange)
            throw new ValidationException("Cannot send a message without first establishing a key exchange with the recipient.");

        Message message = new(request.CurrentUserFingerprint, request.ToPublicKey, encryptedContent, request.MessageHash);
        await messageRepository.AddAsync(message, cancellationToken);

        syncNotifier.NotifyMessage(message.FromPublicKey, message.ToPublicKey);

        return new MessageDto(
            message.FromPublicKey,
            message.ToPublicKey,
            message.EncryptedContent,
            message.MessageHash,
            message.CreatedAt);
    }
}
