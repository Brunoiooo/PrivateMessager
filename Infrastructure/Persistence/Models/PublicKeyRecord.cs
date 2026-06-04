using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Infrastructure.Persistence.Models;

[Table("public_keys")]
public sealed class PublicKeyRecord
{
    [Key]
    [MaxLength(128)]
    public string FingerprintSha512 { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "bytea")]
    public byte[] Der { get; set; } = [];

    [Required]
    [MaxLength(32)]
    public string UserName { get; set; } = string.Empty;

    [Required]
    public uint UserTag { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; }

    [Required]
    public DateTime UpdatedAt { get; set; }
}
