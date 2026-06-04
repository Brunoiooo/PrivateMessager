using Application.Commands;
using Application.Exceptions;
using Application.Interfaces;
using Domain;
using MediatR;

namespace Application.Handlers.Auth;

public sealed class RegisterCommandHandler(
    IPublicKeySecurityService securityService,
    IPublicKeyRepository publicKeyRepository) : IRequestHandler<RegisterCommand, RegisterResult>
{
    public async Task<RegisterResult> Handle(RegisterCommand request, CancellationToken cancellationToken)
    {
        byte[] der;
        try
        {
            der = Convert.FromBase64String(request.DerBase64);
        }
        catch (FormatException ex)
        {
            throw new ValidationException($"DerBase64 is not valid base64: {ex.Message}");
        }

        securityService.EnsureValidRsaPublicKey(der);

        string fingerprint = securityService.ComputeFingerprintSha512(der);

        bool exists = await publicKeyRepository.ExistsAsync(fingerprint, cancellationToken);
        if (exists)
            throw new ConflictException("Public key is already registered.");

        PublicKey publicKey = new(der, fingerprint, request.UserName, request.UserTag);
        await publicKeyRepository.AddAsync(publicKey, cancellationToken);

        return new RegisterResult(publicKey.FingerprintSha512, publicKey.UserName, publicKey.UserTag);
    }
}
