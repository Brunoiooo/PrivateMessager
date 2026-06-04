namespace API.Contracts;

public sealed record RegisterRequest(string DerBase64, string UserName, uint UserTag);
public sealed record RegisterResponse(string FingerprintSha512, string UserName, uint UserTag);
public sealed record ChallengeRequest(string FingerprintSha512);
public sealed record ChallengeResponse(string ChallengeBase64);
public sealed record LoginRequest(string FingerprintSha512, string ChallengeBase64, string SignatureBase64);
public sealed record LoginResponse(string Token, DateTime ExpiresAtUtc);
public sealed record ErrorResponse(string Message);
