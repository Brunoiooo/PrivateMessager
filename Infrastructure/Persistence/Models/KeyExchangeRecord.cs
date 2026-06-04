using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Infrastructure.Persistence.Models;

[Table("key_exchanges")]
[PrimaryKey(nameof(FromPublicKey), nameof(ToPublicKey))]
[Index(nameof(FromPublicKey))]
[Index(nameof(ToPublicKey))]
[Index(nameof(CreatedAt))]
public sealed class KeyExchangeRecord
{
    [Required]
    [MaxLength(128)]
    public string FromPublicKey { get; set; } = string.Empty;

    [Required]
    [MaxLength(128)]
    public string ToPublicKey { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "bytea")]
    public byte[] EncryptedPrivateKey { get; set; } = [];

    [Required]
    public DateTime CreatedAt { get; set; }
}
