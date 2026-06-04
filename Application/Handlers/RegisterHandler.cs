using Domain;

namespace Application;

public sealed class RegisterHandler(IPublicKeySecurityService publicKeySecurityService)
{
    private readonly IPublicKeySecurityService _publicKeySecurityService = publicKeySecurityService;

    public PublicKey Handle(
        byte[] der,
        string userName,
        uint userTag)
    {
        ArgumentNullException.ThrowIfNull(der);
        ArgumentException.ThrowIfNullOrEmpty(userName);

        _publicKeySecurityService.EnsureValidRsaPublicKey(der);
        string fingerprintSha512 = _publicKeySecurityService.ComputeFingerprintSha512(der);

        return new PublicKey(
            der,
            fingerprintSha512,
            userName,
            userTag
            );
    }
}
