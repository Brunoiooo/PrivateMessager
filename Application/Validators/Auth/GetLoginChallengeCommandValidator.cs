using Application.Commands;
using FluentValidation;

namespace Application.Validators.Auth;

public sealed class GetLoginChallengeCommandValidator : AbstractValidator<GetLoginChallengeCommand>
{
    public GetLoginChallengeCommandValidator()
    {
        RuleFor(x => x.FingerprintSha512)
            .NotEmpty().WithMessage("FingerprintSha512 is required.")
            .Length(128).WithMessage("FingerprintSha512 must be exactly 128 characters.")
            .Matches(@"^[0-9a-fA-F]{128}$").WithMessage("FingerprintSha512 must be a hexadecimal string.");
    }
}
