using Application.Commands;
using FluentValidation;

namespace Application.Validators.Auth;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        RuleFor(x => x.FingerprintSha512)
            .NotEmpty()
            .Length(128)
            .Matches(@"^[0-9a-fA-F]{128}$").WithMessage("FingerprintSha512 must be a hexadecimal string.");

        RuleFor(x => x.ChallengeBase64).NotEmpty().WithMessage("ChallengeBase64 is required.");
        RuleFor(x => x.SignatureBase64).NotEmpty().WithMessage("SignatureBase64 is required.");
    }
}
