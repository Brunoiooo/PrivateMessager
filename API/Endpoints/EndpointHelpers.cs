using System.Security.Claims;
using API.Contracts;
using Infrastructure.Services;

namespace API.Endpoints;

internal static class EndpointHelpers
{
    public static bool TrySetCurrentPublicKey(ClaimsPrincipal user, CurrentPublicKeyAccessor accessor, out IResult? error)
    {
        string? currentPublicKey = user.FindFirstValue(ClaimTypes.NameIdentifier);

        if (string.IsNullOrWhiteSpace(currentPublicKey))
        {
            error = Results.Unauthorized();
            return false;
        }

        accessor.SetFingerprintSha512(currentPublicKey);
        error = null;
        return true;
    }
}
