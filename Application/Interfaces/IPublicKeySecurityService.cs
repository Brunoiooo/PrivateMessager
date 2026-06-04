namespace Application;

public interface IPublicKeySecurityService
{
    void EnsureValidRsaPublicKey(byte[] der);

    string ComputeFingerprintSha512(byte[] der);
}
