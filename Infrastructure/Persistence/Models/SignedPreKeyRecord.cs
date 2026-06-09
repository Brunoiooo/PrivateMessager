using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Models;

[Table("signed_prekeys")]
[PrimaryKey(nameof(OwnerFingerprint), nameof(PreKeyId))]
public sealed class SignedPreKeyRecord
{
    [Required]
    [MaxLength(128)]
    public string OwnerFingerprint { get; set; } = string.Empty;

    [Required]
    public int PreKeyId { get; set; }

    [Required]
    [Column(TypeName = "bytea")]
    public byte[] PublicKey { get; set; } = [];

    [Required]
    [Column(TypeName = "bytea")]
    public byte[] Signature { get; set; } = [];

    [Column(TypeName = "bytea")]
    public byte[]? IdentityPublicKey { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; }
}
