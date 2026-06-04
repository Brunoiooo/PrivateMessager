using Application.Commands;
using FluentValidation;

namespace Application.Validators.Auth;

public sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(x => x.DerBase64)
            .NotEmpty().WithMessage("DerBase64 is required.");

        RuleFor(x => x.UserName)
            .NotEmpty().WithMessage("UserName is required.")
            .MinimumLength(3).WithMessage("UserName must be at least 3 characters long.")
            .MaximumLength(32).WithMessage("UserName cannot exceed 32 characters.")
            .Matches(@"^[a-zA-Z0-9_-]+$").WithMessage("UserName can only contain letters, digits, underscores, and hyphens.");

        RuleFor(x => x.UserTag)
            .GreaterThan(0u).WithMessage("UserTag must be greater than 0.")
            .LessThanOrEqualTo(99999u).WithMessage("UserTag must be less than or equal to 99999.");
    }
}
