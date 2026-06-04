using Application;

namespace Infrastructure.Services;

public sealed class CurrentPublicKeyAccessor : ICurrentPublicKey
{
    private static readonly AsyncLocal<string?> _currentFingerprint = new();

    public void SetFingerprintSha512(string fingerprintSha512)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);
        _currentFingerprint.Value = fingerprintSha512;
    }

    public string GetFingerprintSha512()
    {
        if (string.IsNullOrWhiteSpace(_currentFingerprint.Value))
            throw new InvalidOperationException("Current public key fingerprint is not set in request context.");

        return _currentFingerprint.Value;
    }
}
