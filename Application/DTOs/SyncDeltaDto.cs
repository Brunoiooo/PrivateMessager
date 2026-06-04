namespace Application.DTOs;

public sealed record SyncDeltaDto(
    DateTime ServerTimeUtc,
    IReadOnlyList<PublicKeyProfileDto> Profiles,
    IReadOnlyList<KeyExchangeDto> KeyExchanges,
    IReadOnlyList<MessageDto> Messages);
