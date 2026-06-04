using Api.Contracts;
using Application.DTOs;

namespace Api.Extensions;

internal static class DtoMappingExtensions
{
    public static MessageResponse ToResponse(this MessageDto dto) =>
        new(dto.FromPublicKey, dto.ToPublicKey, Convert.ToBase64String(dto.EncryptedContent), dto.MessageHash, dto.CreatedAt);

    public static KeyExchangeResponse ToResponse(this KeyExchangeDto dto) =>
        new(dto.FromPublicKey, dto.ToPublicKey, Convert.ToBase64String(dto.EncryptedPrivateKey), dto.CreatedAt);

    public static SyncDeltaResponse ToResponse(this SyncDeltaDto dto) => new(
        dto.ServerTimeUtc,
        dto.Profiles.Select(p => new PublicKeyProfileResponse(p.FingerprintSha512, p.UserName, p.UserTag, Convert.ToBase64String(p.Der))).ToList(),
        dto.KeyExchanges.Select(k => k.ToResponse()).ToList(),
        dto.Messages.Select(m => m.ToResponse()).ToList());
}
