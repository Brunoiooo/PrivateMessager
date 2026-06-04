using System.Collections.Concurrent;
using System.Threading.Channels;

namespace API.Realtime;

internal sealed class SyncNotificationHub
{
    private sealed class StreamState
    {
        public long Version;

        public Channel<long> SignalChannel { get; } = Channel.CreateBounded<long>(
            new BoundedChannelOptions(1)
            {
                SingleReader = false,
                SingleWriter = false,
                FullMode = BoundedChannelFullMode.DropOldest
            });
    }

    private readonly ConcurrentDictionary<string, StreamState> _streams = new(StringComparer.Ordinal);

    public long GetVersion(string ownerFingerprint, string? peerFingerprint)
    {
        string streamKey = BuildStreamKey(ownerFingerprint, peerFingerprint);
        StreamState state = GetOrCreateState(streamKey);
        return Volatile.Read(ref state.Version);
    }

    public async ValueTask<long> WaitForChangeAsync(
        string ownerFingerprint,
        string? peerFingerprint,
        long lastSeenVersion,
        CancellationToken cancellationToken)
    {
        string streamKey = BuildStreamKey(ownerFingerprint, peerFingerprint);
        StreamState state = GetOrCreateState(streamKey);

        long currentVersion = Volatile.Read(ref state.Version);
        if (currentVersion > lastSeenVersion)
        {
            return currentVersion;
        }

        while (await state.SignalChannel.Reader.WaitToReadAsync(cancellationToken).ConfigureAwait(false))
        {
            while (state.SignalChannel.Reader.TryRead(out long notifiedVersion))
            {
                if (notifiedVersion > lastSeenVersion)
                {
                    return notifiedVersion;
                }
            }

            currentVersion = Volatile.Read(ref state.Version);
            if (currentVersion > lastSeenVersion)
            {
                return currentVersion;
            }
        }

        return lastSeenVersion;
    }

    public void NotifyMessage(string fromPublicKey, string toPublicKey)
    {
        NotifyPair(fromPublicKey, toPublicKey);
    }

    public void NotifyKeyExchange(string fromPublicKey, string toPublicKey)
    {
        NotifyPair(fromPublicKey, toPublicKey);
    }

    private void NotifyPair(string fromPublicKey, string toPublicKey)
    {
        Notify(fromPublicKey, null);
        Notify(toPublicKey, null);

        Notify(fromPublicKey, toPublicKey);
        Notify(toPublicKey, fromPublicKey);
    }

    private void Notify(string ownerFingerprint, string? peerFingerprint)
    {
        string streamKey = BuildStreamKey(ownerFingerprint, peerFingerprint);
        StreamState state = GetOrCreateState(streamKey);

        long nextVersion = Interlocked.Increment(ref state.Version);
        state.SignalChannel.Writer.TryWrite(nextVersion);
    }

    private StreamState GetOrCreateState(string streamKey)
    {
        return _streams.GetOrAdd(streamKey, _ => new StreamState());
    }

    private static string BuildStreamKey(string ownerFingerprint, string? peerFingerprint)
    {
        if (string.IsNullOrWhiteSpace(peerFingerprint))
        {
            return $"inbox:{ownerFingerprint}";
        }

        return $"conversation:{ownerFingerprint}|{peerFingerprint}";
    }
}
