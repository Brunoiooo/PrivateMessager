using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Api.Security;

public sealed class JwtTokenIssuer(string signingKey)
{
    public const string Issuer = "messager-api";
    public const string Audience = "messager-client";

    private readonly byte[] _keyBytes = Encoding.UTF8.GetBytes(signingKey);

    public (string Token, DateTime ExpiresAtUtc) Generate(string fingerprintSha512)
    {
        DateTime expiresAtUtc = DateTime.UtcNow.AddHours(12);

        SigningCredentials credentials = new(
            new SymmetricSecurityKey(_keyBytes),
            SecurityAlgorithms.HmacSha256);

        JwtSecurityToken jwt = new(
            issuer: Issuer,
            audience: Audience,
            claims: [new Claim(ClaimTypes.NameIdentifier, fingerprintSha512)],
            expires: expiresAtUtc,
            signingCredentials: credentials);

        return (new JwtSecurityTokenHandler().WriteToken(jwt), expiresAtUtc);
    }
}
