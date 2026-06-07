using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Infrastructure.Persistence.Models;

[Table("messages")]
[PrimaryKey(nameof(FromPublicKey), nameof(ToPublicKey), nameof(MessageHash))]
[Index(nameof(FromPublicKey))]
[Index(nameof(ToPublicKey))]
[Index(nameof(CreatedAt))]
[Index(nameof(ExpiresAt))]
public sealed class MessageRecord
{
    [Required]
    [MaxLength(128)]
    public string FromPublicKey { get; set; } = string.Empty;

    [Required]
    [MaxLength(128)]
    public string ToPublicKey { get; set; } = string.Empty;

    [Required]
    [Column(TypeName = "bytea")]
    public byte[] EncryptedContent { get; set; } = [];

    [Required]
    [MaxLength(128)]
    public string MessageHash { get; set; } = string.Empty;

    [Required]
    public DateTime CreatedAt { get; set; }

    [Required]
    public DateTime ExpiresAt { get; set; }

    // X3DH fields: set only on the first Signal Protocol message that initialises a session.
    [Column(TypeName = "bytea")]
    public byte[]? X3dhEphemeralKey { get; set; }

    public int? X3dhSignedPreKeyId { get; set; }

    public Guid? X3dhOtpId { get; set; }

    // 1 = WhisperMessage, 3 = PreKeyWhisperMessage, null = legacy chain-key message.
    public int? SignalMessageType { get; set; }
}
