using Application.Commands;
using FluentValidation;

namespace Application.Validators.KeyExchanges;

public sealed class SendKeyExchangeCommandValidator : AbstractValidator<SendKeyExchangeCommand>
{
    public SendKeyExchangeCommandValidator()
    {
        RuleFor(x => x.ToPublicKey)
            .NotEmpty()
            .Length(128)
            .Matches(@"^[0-9a-fA-F]{128}$").WithMessage("ToPublicKey must be a 128-character hexadecimal string.");

        RuleFor(x => x.EncryptedPrivateKeyBase64).NotEmpty().WithMessage("EncryptedPrivateKeyBase64 is required.");
    }
}
