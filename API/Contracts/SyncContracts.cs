namespace API.Contracts;

public sealed record SyncDeltaResponse(
    DateTime ServerTimeUtc,
    IReadOnlyList<PublicKeyProfileResponse> Profiles,
    IReadOnlyList<KeyExchangeResponse> KeyExchanges,
    IReadOnlyList<MessageResponse> Messages);
