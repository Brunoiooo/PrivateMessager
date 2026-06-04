using System.Security.Claims;

namespace Api.Extensions;

internal static class ClaimsPrincipalExtensions
{
    public static string GetFingerprint(this ClaimsPrincipal user)
    {
        string? fingerprint = user.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(fingerprint))
            throw new InvalidOperationException("Fingerprint claim is missing from the token.");

        return fingerprint;
    }

    public static bool TryGetFingerprint(this ClaimsPrincipal user, out string? fingerprint)
    {
        fingerprint = user.FindFirstValue(ClaimTypes.NameIdentifier);
        return !string.IsNullOrWhiteSpace(fingerprint);
    }
}
