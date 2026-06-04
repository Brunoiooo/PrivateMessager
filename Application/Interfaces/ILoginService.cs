namespace Application.Interfaces;

public interface ILoginService
{
    Task ValidateAndConsumeAsync(
        string fingerprintSha512,
        byte[] challenge,
        byte[] signature,
        CancellationToken ct = default);
}
