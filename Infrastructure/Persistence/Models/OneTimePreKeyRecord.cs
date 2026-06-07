using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.Models;

[Table("one_time_prekeys")]
[Index(nameof(OwnerFingerprint), nameof(ConsumedAt))]
public sealed class OneTimePreKeyRecord
{
    [Key]
    public Guid Id { get; set; }

    [Required]
    [MaxLength(128)]
    public string OwnerFingerprint { get; set; } = string.Empty;

    [Required]
    public int PreKeyId { get; set; }

    [Required]
    [Column(TypeName = "bytea")]
    public byte[] PublicKey { get; set; } = [];

    public DateTime? ConsumedAt { get; set; }

    [Required]
    public DateTime CreatedAt { get; set; }
}
