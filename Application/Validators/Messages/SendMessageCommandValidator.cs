using Application.Commands;
using FluentValidation;

namespace Application.Validators.Messages;

public sealed class SendMessageCommandValidator : AbstractValidator<SendMessageCommand>
{
    public SendMessageCommandValidator()
    {
        RuleFor(x => x.ToPublicKey)
            .NotEmpty()
            .Length(128)
            .Matches(@"^[0-9a-fA-F]{128}$").WithMessage("ToPublicKey must be a 128-character hexadecimal string.");

        RuleFor(x => x.EncryptedContentBase64).NotEmpty().WithMessage("EncryptedContentBase64 is required.");

        RuleFor(x => x.MessageHash)
            .NotEmpty()
            .Length(128)
            .Matches(@"^[0-9a-fA-F]{128}$").WithMessage("MessageHash must be a 128-character hexadecimal string.");
    }
}
