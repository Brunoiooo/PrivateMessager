using Application.DTOs;
using Domain;

namespace Application.Interfaces;

public interface IPublicKeyRepository
{
    Task<PublicKey?> FindAsync(string fingerprintSha512, CancellationToken ct = default);
    Task<bool> ExistsAsync(string fingerprintSha512, CancellationToken ct = default);
    Task AddAsync(PublicKey publicKey, CancellationToken ct = default);
    Task<IReadOnlyList<PublicKeyProfileDto>> SearchAsync(string userNamePattern, uint? userTag, int limit, CancellationToken ct = default);
    Task<IReadOnlyList<PublicKeyProfileDto>> GetByFingerprintsAsync(IEnumerable<string> fingerprints, CancellationToken ct = default);
}
