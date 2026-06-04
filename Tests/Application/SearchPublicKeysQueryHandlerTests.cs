using Application.DTOs;
using Application.Exceptions;
using Application.Handlers.PublicKeys;
using Application.Interfaces;
using Application.Queries;
using NSubstitute;

namespace Tests.Application;

public sealed class SearchPublicKeysQueryHandlerTests
{
    private readonly IPublicKeyRepository _repository = Substitute.For<IPublicKeyRepository>();
    private readonly SearchPublicKeysQueryHandler _handler;

    public SearchPublicKeysQueryHandlerTests()
    {
        _handler = new SearchPublicKeysQueryHandler(_repository);
    }

    [Fact]
    public async Task Handle_WithShortQuery_ThrowsValidationException()
    {
        await Assert.ThrowsAsync<ValidationException>(() =>
            _handler.Handle(new SearchPublicKeysQuery("a", null, null), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_WithValidQuery_ClampsLimit()
    {
        _repository.SearchAsync(Arg.Any<string>(), Arg.Any<uint?>(), 100, Arg.Any<CancellationToken>())
            .Returns(new List<PublicKeyProfileDto>());

        await _handler.Handle(new SearchPublicKeysQuery("  alice  ", null, 999), CancellationToken.None);

        await _repository.Received(1).SearchAsync(Arg.Any<string>(), null, 100, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_EscapesWildcardCharacters()
    {
        _repository.SearchAsync(Arg.Any<string>(), Arg.Any<uint?>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(new List<PublicKeyProfileDto>());

        await _handler.Handle(new SearchPublicKeysQuery("al%ice_test", null, null), CancellationToken.None);

        await _repository.Received(1).SearchAsync(
            Arg.Is<string>(s => s.Contains("\\%") && s.Contains("\\_")),
            null,
            Arg.Any<int>(),
            Arg.Any<CancellationToken>());
    }
}
