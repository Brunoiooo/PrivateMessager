using System.Text.RegularExpressions;

namespace Domain;

internal static partial class Fingerprint
{
    [GeneratedRegex(@"^[0-9a-fA-F]{128}$", RegexOptions.Compiled)]
    private static partial Regex HexPattern();

    public static void Validate(string value, string paramName)
    {
        ArgumentException.ThrowIfNullOrEmpty(value, paramName);

        if (value.Length != 128 || !HexPattern().IsMatch(value))
            throw new ArgumentException("Must be a 128-character hexadecimal string (SHA-512).", paramName);
    }
}
