namespace Application;

public interface ILoginChallengeService
{
    byte[] GetChallenge(string fingerprintSha512);
}
