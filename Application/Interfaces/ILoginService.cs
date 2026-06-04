namespace Application;

public interface ILoginService
{
    string Login(string fingerprintSha512, byte[] challenge, byte[] signature);
}
