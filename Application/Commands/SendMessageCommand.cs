using Application.DTOs;
using MediatR;

namespace Application.Commands;

public sealed record SendMessageCommand(
    string CurrentUserFingerprint,
    string ToPublicKey,
    string EncryptedContentBase64,
    string MessageHash) : IRequest<MessageDto>;
