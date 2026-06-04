using Application.DTOs;
using MediatR;

namespace Application.Commands;

public sealed record SendKeyExchangeCommand(
    string CurrentUserFingerprint,
    string ToPublicKey,
    string EncryptedPrivateKeyBase64) : IRequest<KeyExchangeDto>;
