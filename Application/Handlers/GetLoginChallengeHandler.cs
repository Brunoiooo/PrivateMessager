namespace Application;

public sealed class GetLoginChallengeHandler(ILoginChallengeService loginChallengeService)
{
    private readonly ILoginChallengeService _loginChallengeService = loginChallengeService;

    public byte[] Handle(string fingerprintSha512)
    {
        ArgumentException.ThrowIfNullOrEmpty(fingerprintSha512);

        return _loginChallengeService.GetChallenge(fingerprintSha512);
    }
}
