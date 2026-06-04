using Application.Commands;
using Application.Exceptions;
using Application.Handlers.Messages;
using Application.Interfaces;
using Domain;
using NSubstitute;

namespace Tests.Application;

public sealed class SendMessageCommandHandlerTests
{
    private readonly IKeyExchangeRepository _keyExchangeRepo = Substitute.For<IKeyExchangeRepository>();
    private readonly IMessageRepository _messageRepo = Substitute.For<IMessageRepository>();
    private readonly ISyncNotifier _notifier = Substitute.For<ISyncNotifier>();
    private readonly SendMessageCommandHandler _handler;

    private static readonly string FromFingerprint = new('a', 128);
    private static readonly string ToFingerprint = new('b', 128);
    private static readonly string MessageHash = new('c', 128);

    public SendMessageCommandHandlerTests()
    {
        _handler = new SendMessageCommandHandler(_keyExchangeRepo, _messageRepo, _notifier);
    }

    [Fact]
    public async Task Handle_WithValidCommandAndExistingKeyExchange_PersistsAndNotifies()
    {
        string contentBase64 = Convert.ToBase64String([1, 2, 3]);
        _keyExchangeRepo.ExistsAsync(FromFingerprint, ToFingerprint, Arg.Any<CancellationToken>()).Returns(true);

        var result = await _handler.Handle(
            new SendMessageCommand(FromFingerprint, ToFingerprint, contentBase64, MessageHash),
            CancellationToken.None);

        Assert.Equal(FromFingerprint, result.FromPublicKey);
        Assert.Equal(ToFingerprint, result.ToPublicKey);
        await _messageRepo.Received(1).AddAsync(Arg.Any<Message>(), Arg.Any<CancellationToken>());
        _notifier.Received(1).NotifyMessage(FromFingerprint, ToFingerprint);
    }

    [Fact]
    public async Task Handle_WithoutKeyExchange_ThrowsValidationException()
    {
        _keyExchangeRepo.ExistsAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(false);

        await Assert.ThrowsAsync<ValidationException>(() =>
            _handler.Handle(
                new SendMessageCommand(FromFingerprint, ToFingerprint, Convert.ToBase64String([1, 2, 3]), MessageHash),
                CancellationToken.None));

        await _messageRepo.DidNotReceive().AddAsync(Arg.Any<Message>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithInvalidBase64_ThrowsValidationException()
    {
        await Assert.ThrowsAsync<ValidationException>(() =>
            _handler.Handle(
                new SendMessageCommand(FromFingerprint, ToFingerprint, "not-base64!!!", MessageHash),
                CancellationToken.None));
    }
}
