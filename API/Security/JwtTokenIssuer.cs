using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace API.Security;

internal sealed class JwtTokenIssuer(string signingKey)
{
    public const string Issuer = "messager-api";
    public const string Audience = "messager-client";

    private readonly byte[] _keyBytes = Encoding.UTF8.GetBytes(signingKey);

    public (string Token, DateTime ExpiresAtUtc) Generate(string fingerprintSha512)
    {
        DateTime expiresAtUtc = DateTime.UtcNow.AddHours(12);

        List<Claim> claims =
        [
            new(ClaimTypes.NameIdentifier, fingerprintSha512)
        ];

        SigningCredentials credentials = new(
            new SymmetricSecurityKey(_keyBytes),
            SecurityAlgorithms.HmacSha256);

        JwtSecurityToken jwt = new(
            issuer: Issuer,
            audience: Audience,
            claims: claims,
            expires: expiresAtUtc,
            signingCredentials: credentials);

        string token = new JwtSecurityTokenHandler().WriteToken(jwt);
        return (token, expiresAtUtc);
    }
}
