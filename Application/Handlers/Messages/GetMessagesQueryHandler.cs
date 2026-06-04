using Application.DTOs;
using Application.Interfaces;
using Application.Queries;
using MediatR;

namespace Application.Handlers.Messages;

public sealed class GetMessagesQueryHandler(IMessageRepository messageRepository)
    : IRequestHandler<GetMessagesQuery, IReadOnlyList<MessageDto>>
{
    public Task<IReadOnlyList<MessageDto>> Handle(GetMessagesQuery request, CancellationToken cancellationToken) =>
        messageRepository.GetConversationAsync(
            request.CurrentUserFingerprint,
            request.PeerPublicKey,
            request.FromDate,
            request.ToDate,
            cancellationToken);
}
