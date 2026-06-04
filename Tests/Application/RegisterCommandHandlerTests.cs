using Application.Commands;
using Application.Exceptions;
using Application.Handlers.Auth;
using Application.Interfaces;
using Domain;
using NSubstitute;

namespace Tests.Application;

public sealed class RegisterCommandHandlerTests
{
    private readonly IPublicKeySecurityService _security = Substitute.For<IPublicKeySecurityService>();
    private readonly IPublicKeyRepository _repository = Substitute.For<IPublicKeyRepository>();
    private readonly RegisterCommandHandler _handler;

    private static readonly string ValidFingerprint = new('a', 128);
    private static readonly byte[] ValidDer = new byte[256];
    private static readonly string ValidDerBase64 = Convert.ToBase64String(ValidDer);

    public RegisterCommandHandlerTests()
    {
        _handler = new RegisterCommandHandler(_security, _repository);
        _security.ComputeFingerprintSha512(Arg.Any<byte[]>()).Returns(ValidFingerprint);
    }

    [Fact]
    public async Task Handle_WithValidCommand_ReturnsResult()
    {
        _repository.ExistsAsync(ValidFingerprint, Arg.Any<CancellationToken>()).Returns(false);

        RegisterResult result = await _handler.Handle(
            new RegisterCommand(ValidDerBase64, "Alice", 1111),
            CancellationToken.None);

        Assert.Equal(ValidFingerprint, result.FingerprintSha512);
        Assert.Equal("Alice", result.UserName);
        Assert.Equal(1111u, result.UserTag);
        await _repository.Received(1).AddAsync(Arg.Any<PublicKey>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithDuplicateKey_ThrowsConflictException()
    {
        _repository.ExistsAsync(ValidFingerprint, Arg.Any<CancellationToken>()).Returns(true);

        await Assert.ThrowsAsync<ConflictException>(() =>
            _handler.Handle(new RegisterCommand(ValidDerBase64, "Alice", 1111), CancellationToken.None));

        await _repository.DidNotReceive().AddAsync(Arg.Any<PublicKey>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithInvalidBase64_ThrowsValidationException()
    {
        await Assert.ThrowsAsync<ValidationException>(() =>
            _handler.Handle(new RegisterCommand("not-valid-base64!!!", "Alice", 1111), CancellationToken.None));
    }
}
