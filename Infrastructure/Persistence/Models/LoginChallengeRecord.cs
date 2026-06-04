using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Infrastructure.Persistence.Models;

[Table("login_challenges")]
[Index(nameof(FingerprintSha512))]
[Index(nameof(ExpiresAt))]
public sealed class LoginChallengeRecord
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string FingerprintSha512 { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "bytea")]
    public byte[] Challenge { get; set; } = [];

    [Required]
    public DateTime ExpiresAt { get; set; }

    public DateTime? ConsumedAt { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; }
}
