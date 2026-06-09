using System.Security.Claims;
using API.Contracts;
using Infrastructure.Persistence;
using Infrastructure.Persistence.Models;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace API.Endpoints;

internal static class PreKeyEndpoints
{
    public static RouteGroupBuilder MapPreKeyEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/prekeys").RequireAuthorization();

        group.MapPost("/bundle", async (
            ClaimsPrincipal user,
            UploadPreKeyBundleRequest request,
            CurrentPublicKeyAccessor accessor,
            MessagerDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (!EndpointHelpers.TrySetCurrentPublicKey(user, accessor, out IResult? error))
                return error!;

            string ownerFingerprint = accessor.GetFingerprintSha512();

            byte[] identityPublicKey;
            byte[] signedPreKeyPublic;
            byte[] signature;

            try
            {
                identityPublicKey = Convert.FromBase64String(request.IdentityKeyPublicBase64);
                signedPreKeyPublic = Convert.FromBase64String(request.SignedPreKeyPublicBase64);
                signature = Convert.FromBase64String(request.SignatureBase64);
            }
            catch (FormatException)
            {
                return Results.BadRequest(new ErrorResponse("Invalid base64 in signed prekey fields."));
            }

            // Upsert the signed prekey (replace if same id).
            SignedPreKeyRecord signedPreKey = new()
            {
                OwnerFingerprint = ownerFingerprint,
                PreKeyId = request.SignedPreKeyId,
                PublicKey = signedPreKeyPublic,
                Signature = signature,
                IdentityPublicKey = identityPublicKey,
                CreatedAt = DateTime.UtcNow,
            };

            dbContext.SignedPreKeys.RemoveRange(
                dbContext.SignedPreKeys.Where(x => x.OwnerFingerprint == ownerFingerprint));

            dbContext.SignedPreKeys.Add(signedPreKey);

            // Append new one-time prekeys (ignore duplicates by PreKeyId).
            if (request.OneTimePreKeys.Count > 0)
            {
                HashSet<int> existingIds = (await dbContext.OneTimePreKeys
                    .Where(x => x.OwnerFingerprint == ownerFingerprint)
                    .Select(x => x.PreKeyId)
                    .ToListAsync(cancellationToken))
                    .ToHashSet();

                foreach (OneTimePreKeyEntry entry in request.OneTimePreKeys)
                {
                    if (existingIds.Contains(entry.PreKeyId))
                        continue;

                    byte[] otpPublic;

                    try
                    {
                        otpPublic = Convert.FromBase64String(entry.PublicBase64);
                    }
                    catch (FormatException)
                    {
                        continue;
                    }

                    dbContext.OneTimePreKeys.Add(new OneTimePreKeyRecord
                    {
                        Id = Guid.NewGuid(),
                        OwnerFingerprint = ownerFingerprint,
                        PreKeyId = entry.PreKeyId,
                        PublicKey = otpPublic,
                        CreatedAt = DateTime.UtcNow,
                    });
                }
            }

            await dbContext.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        });

        group.MapGet("/{fingerprint}", async (
            ClaimsPrincipal user,
            string fingerprint,
            CurrentPublicKeyAccessor accessor,
            MessagerDbContext dbContext,
            CancellationToken cancellationToken) =>
        {
            if (!EndpointHelpers.TrySetCurrentPublicKey(user, accessor, out IResult? error))
                return error!;

            bool profileExists = await dbContext.PublicKeys
                .AnyAsync(x => x.FingerprintSha512 == fingerprint, cancellationToken);

            if (!profileExists)
                return Results.NotFound(new ErrorResponse("Profile not found."));

            var signedPreKey = await dbContext.SignedPreKeys
                .Where(x => x.OwnerFingerprint == fingerprint)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (signedPreKey is null || signedPreKey.IdentityPublicKey is null)
                return Results.NotFound(new ErrorResponse("No signed prekey on file for this user."));

            // Consume one unused OTP (mark as consumed and return it).
            var otp = await dbContext.OneTimePreKeys
                .Where(x => x.OwnerFingerprint == fingerprint && x.ConsumedAt == null)
                .OrderBy(x => x.CreatedAt)
                .FirstOrDefaultAsync(cancellationToken);

            if (otp is not null)
            {
                otp.ConsumedAt = DateTime.UtcNow;
                await dbContext.SaveChangesAsync(cancellationToken);
            }

            return Results.Ok(new PreKeyBundleResponse(
                Convert.ToBase64String(signedPreKey.IdentityPublicKey!),
                signedPreKey.PreKeyId,
                Convert.ToBase64String(signedPreKey.PublicKey),
                Convert.ToBase64String(signedPreKey.Signature),
                otp?.Id,
                otp is not null ? Convert.ToBase64String(otp.PublicKey) : null));
        });

        return group;
    }
}
