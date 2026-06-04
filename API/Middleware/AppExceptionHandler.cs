using Api.Contracts;
using Application.Exceptions;
using Microsoft.AspNetCore.Diagnostics;
using FvValidationException = FluentValidation.ValidationException;
using AppValidationException = Application.Exceptions.ValidationException;

namespace Api.Middleware;

internal sealed class AppExceptionHandler(ILogger<AppExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context,
        Exception exception,
        CancellationToken cancellationToken)
    {
        (int statusCode, string message) = exception switch
        {
            FvValidationException fv  => (StatusCodes.Status400BadRequest, FormatFluentValidationErrors(fv)),
            NotFoundException ex      => (StatusCodes.Status404NotFound, ex.Message),
            ConflictException ex      => (StatusCodes.Status409Conflict, ex.Message),
            UnauthorizedException ex  => (StatusCodes.Status401Unauthorized, ex.Message),
            AppValidationException ex => (StatusCodes.Status400BadRequest, ex.Message),
            ArgumentException ex      => (StatusCodes.Status400BadRequest, ex.Message),
            OperationCanceledException => (StatusCodes.Status499ClientClosedRequest, "Request cancelled."),
            _                          => (StatusCodes.Status500InternalServerError, "An unexpected error occurred.")
        };

        if (statusCode == StatusCodes.Status500InternalServerError)
            logger.LogError(exception, "Unhandled exception");

        context.Response.StatusCode = statusCode;
        await context.Response.WriteAsJsonAsync(new ErrorResponse(message), cancellationToken);
        return true;
    }

    private static string FormatFluentValidationErrors(FvValidationException ex) =>
        string.Join("; ", ex.Errors.Select(e => e.ErrorMessage));
}
