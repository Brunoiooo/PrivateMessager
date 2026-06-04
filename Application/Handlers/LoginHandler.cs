namespace Application;

public sealed class LoginHandler(ILoginService loginService)
{
    private readonly ILoginService _loginService = loginService;

    public string Handle(string fingerprintSha512, byte[] challenge, byte[] signature)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);
        ArgumentNullException.ThrowIfNull(challenge);
        ArgumentNullException.ThrowIfNull(signature);

        return _loginService.Login(fingerprintSha512, challenge, signature);
    }
}
