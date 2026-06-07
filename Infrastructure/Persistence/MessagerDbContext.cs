using Infrastructure.Persistence.Models;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence;

public sealed class MessagerDbContext(DbContextOptions<MessagerDbContext> options) : DbContext(options)
{
    public DbSet<PublicKeyRecord> PublicKeys => Set<PublicKeyRecord>();

    public DbSet<MessageRecord> Messages => Set<MessageRecord>();

    public DbSet<KeyExchangeRecord> KeyExchanges => Set<KeyExchangeRecord>();

    public DbSet<LoginChallengeRecord> LoginChallenges => Set<LoginChallengeRecord>();

    public DbSet<SignedPreKeyRecord> SignedPreKeys => Set<SignedPreKeyRecord>();

    public DbSet<OneTimePreKeyRecord> OneTimePreKeys => Set<OneTimePreKeyRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PublicKeyRecord>(entity =>
        {
            entity.ToTable("public_keys");
            entity.HasKey(x => x.FingerprintSha512);
            entity.Property(x => x.FingerprintSha512).HasMaxLength(128);
            entity.Property(x => x.UserName).HasMaxLength(32);
            entity.Property(x => x.Der).HasColumnType("bytea");
        });

        modelBuilder.Entity<MessageRecord>(entity =>
        {
            entity.ToTable("messages");
            entity.HasKey(x => new { x.FromPublicKey, x.ToPublicKey, x.MessageHash });
            entity.Property(x => x.FromPublicKey).HasMaxLength(128);
            entity.Property(x => x.ToPublicKey).HasMaxLength(128);
            entity.Property(x => x.MessageHash).HasMaxLength(128);
            entity.Property(x => x.EncryptedContent).HasColumnType("bytea");
            entity.HasIndex(x => x.FromPublicKey);
            entity.HasIndex(x => x.ToPublicKey);
            entity.HasIndex(x => x.CreatedAt);

            entity.HasOne<PublicKeyRecord>()
                .WithMany()
                .HasForeignKey(x => x.FromPublicKey)
                .HasPrincipalKey(x => x.FingerprintSha512)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<PublicKeyRecord>()
                .WithMany()
                .HasForeignKey(x => x.ToPublicKey)
                .HasPrincipalKey(x => x.FingerprintSha512)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<KeyExchangeRecord>(entity =>
        {
            entity.ToTable("key_exchanges");
            entity.HasKey(x => new { x.FromPublicKey, x.ToPublicKey });
            entity.Property(x => x.FromPublicKey).HasMaxLength(128);
            entity.Property(x => x.ToPublicKey).HasMaxLength(128);
            entity.Property(x => x.EncryptedPrivateKey).HasColumnType("bytea");
            entity.HasIndex(x => x.FromPublicKey);
            entity.HasIndex(x => x.ToPublicKey);
            entity.HasIndex(x => x.CreatedAt);

            entity.HasOne<PublicKeyRecord>()
                .WithMany()
                .HasForeignKey(x => x.FromPublicKey)
                .HasPrincipalKey(x => x.FingerprintSha512)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne<PublicKeyRecord>()
                .WithMany()
                .HasForeignKey(x => x.ToPublicKey)
                .HasPrincipalKey(x => x.FingerprintSha512)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<LoginChallengeRecord>(entity =>
        {
            entity.ToTable("login_challenges");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.FingerprintSha512).HasMaxLength(128);
            entity.Property(x => x.Challenge).HasColumnType("bytea");
            entity.HasIndex(x => x.FingerprintSha512);
            entity.HasIndex(x => x.ExpiresAt);

            entity.HasOne<PublicKeyRecord>()
                .WithMany()
                .HasForeignKey(x => x.FingerprintSha512)
                .HasPrincipalKey(x => x.FingerprintSha512)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<SignedPreKeyRecord>(entity =>
        {
            entity.ToTable("signed_prekeys");
            entity.HasKey(x => new { x.OwnerFingerprint, x.PreKeyId });
            entity.Property(x => x.OwnerFingerprint).HasMaxLength(128);
            entity.Property(x => x.PublicKey).HasColumnType("bytea");
            entity.Property(x => x.Signature).HasColumnType("bytea");

            entity.HasOne<PublicKeyRecord>()
                .WithMany()
                .HasForeignKey(x => x.OwnerFingerprint)
                .HasPrincipalKey(x => x.FingerprintSha512)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<OneTimePreKeyRecord>(entity =>
        {
            entity.ToTable("one_time_prekeys");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.OwnerFingerprint).HasMaxLength(128);
            entity.Property(x => x.PublicKey).HasColumnType("bytea");
            entity.HasIndex(x => new { x.OwnerFingerprint, x.ConsumedAt });

            entity.HasOne<PublicKeyRecord>()
                .WithMany()
                .HasForeignKey(x => x.OwnerFingerprint)
                .HasPrincipalKey(x => x.FingerprintSha512)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
