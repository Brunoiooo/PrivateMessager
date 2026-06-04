using Application.DTOs;
using Application.Interfaces;
using Application.Queries;
using MediatR;

namespace Application.Handlers.Sync;

public sealed class GetSyncDeltaQueryHandler(
    IMessageRepository messageRepository,
    IKeyExchangeRepository keyExchangeRepository,
    IPublicKeyRepository publicKeyRepository) : IRequestHandler<GetSyncDeltaQuery, SyncDeltaDto>
{
    private const int DefaultLimit = 200;
    private const int MaxLimit = 1000;

    public async Task<SyncDeltaDto> Handle(GetSyncDeltaQuery request, CancellationToken cancellationToken)
    {
        DateTime since = request.Since?.ToUniversalTime() ?? DateTime.UnixEpoch;
        int limit = Math.Clamp(request.Limit ?? DefaultLimit, 1, MaxLimit);

        IReadOnlyList<MessageDto> messages = await messageRepository.GetSinceAsync(
            request.CurrentUserFingerprint, since, limit, request.PeerFilter, cancellationToken);

        IReadOnlyList<KeyExchangeDto> keyExchanges = await keyExchangeRepository.GetSinceAsync(
            request.CurrentUserFingerprint, since, limit, request.PeerFilter, cancellationToken);

        if (messages.Count == 0 && keyExchanges.Count == 0)
            return new SyncDeltaDto(DateTime.UtcNow, [], [], []);

        HashSet<string> fingerprints =
        [
            request.CurrentUserFingerprint,
            .. messages.SelectMany(m => new[] { m.FromPublicKey, m.ToPublicKey }),
            .. keyExchanges.SelectMany(k => new[] { k.FromPublicKey, k.ToPublicKey })
        ];

        IReadOnlyList<PublicKeyProfileDto> profiles =
            await publicKeyRepository.GetByFingerprintsAsync(fingerprints, cancellationToken);

        return new SyncDeltaDto(DateTime.UtcNow, profiles, keyExchanges, messages);
    }
}
