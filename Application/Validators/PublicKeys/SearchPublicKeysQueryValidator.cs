using Application.Queries;
using FluentValidation;

namespace Application.Validators.PublicKeys;

public sealed class SearchPublicKeysQueryValidator : AbstractValidator<SearchPublicKeysQuery>
{
    public SearchPublicKeysQueryValidator()
    {
        RuleFor(x => x.UserName)
            .NotEmpty().WithMessage("UserName is required.")
            .MinimumLength(2).WithMessage("UserName must be at least 2 characters.");

        RuleFor(x => x.Limit)
            .InclusiveBetween(1, 100).When(x => x.Limit.HasValue)
            .WithMessage("Limit must be between 1 and 100.");
    }
}
