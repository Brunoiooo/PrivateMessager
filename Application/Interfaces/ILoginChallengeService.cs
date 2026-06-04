namespace Application.Interfaces;

public interface ILoginChallengeService
{
    Task<byte[]> CreateChallengeAsync(string fingerprintSha512, CancellationToken ct = default);

    Task<byte[]> ConsumeValidChallengeAsync(string fingerprintSha512, byte[] challenge, CancellationToken ct = default);
}
