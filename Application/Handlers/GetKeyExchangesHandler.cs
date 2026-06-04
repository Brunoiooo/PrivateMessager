using Domain;

namespace Application;

public sealed class GetKeyExchangesHandler(
    ICurrentPublicKey currentPublicKey,
    IPublicKeyRepository publicKeyRepository)
{
    private readonly ICurrentPublicKey _currentPublicKey = currentPublicKey;
    private readonly IPublicKeyRepository _publicKeyRepository = publicKeyRepository;

    public IReadOnlyList<KeyExchange> Handle(
        string toPublicKey,
        DateTime? fromDate = null,
        DateTime? toDate = null)
    {
        ArgumentException.ThrowIfNullOrEmpty(toPublicKey);

        PublicKey publicKey = _publicKeyRepository.GetRequired(_currentPublicKey.GetFingerprintSha512());
        return publicKey.GetKeyExchanges(toPublicKey, fromDate, toDate);
    }
}
