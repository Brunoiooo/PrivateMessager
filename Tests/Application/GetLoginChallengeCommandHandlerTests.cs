using Application.Commands;
using Application.Exceptions;
using Application.Handlers.Auth;
using Application.Interfaces;
using NSubstitute;

namespace Tests.Application;

public sealed class GetLoginChallengeCommandHandlerTests
{
    private readonly IPublicKeyRepository _repository = Substitute.For<IPublicKeyRepository>();
    private readonly ILoginChallengeService _challengeService = Substitute.For<ILoginChallengeService>();
    private readonly GetLoginChallengeCommandHandler _handler;

    private static readonly string Fingerprint = new('a', 128);

    public GetLoginChallengeCommandHandlerTests()
    {
        _handler = new GetLoginChallengeCommandHandler(_repository, _challengeService);
    }

    [Fact]
    public async Task Handle_WhenKeyExists_ReturnsChallenge()
    {
        byte[] expected = new byte[64];
        _repository.ExistsAsync(Fingerprint, Arg.Any<CancellationToken>()).Returns(true);
        _challengeService.CreateChallengeAsync(Fingerprint, Arg.Any<CancellationToken>()).Returns(expected);

        byte[] result = await _handler.Handle(new GetLoginChallengeCommand(Fingerprint), CancellationToken.None);

        Assert.Equal(expected, result);
    }

    [Fact]
    public async Task Handle_WhenKeyDoesNotExist_ThrowsNotFoundException()
    {
        _repository.ExistsAsync(Fingerprint, Arg.Any<CancellationToken>()).Returns(false);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            _handler.Handle(new GetLoginChallengeCommand(Fingerprint), CancellationToken.None));

        await _challengeService.DidNotReceive().CreateChallengeAsync(Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}
