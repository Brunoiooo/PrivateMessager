using Domain;

namespace Application;

public interface IPublicKeyRepository
{
    PublicKey GetRequired(string fingerprintSha512);
}
