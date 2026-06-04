using System.Collections.Concurrent;
using System.Threading.Channels;

namespace Api.Realtime;

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
        StreamState state = GetOrCreateState(BuildStreamKey(ownerFingerprint, peerFingerprint));
        return Volatile.Read(ref state.Version);
    }

    public async ValueTask<long> WaitForChangeAsync(
        string ownerFingerprint,
        string? peerFingerprint,
        long lastSeenVersion,
        CancellationToken cancellationToken)
    {
        StreamState state = GetOrCreateState(BuildStreamKey(ownerFingerprint, peerFingerprint));

        long current = Volatile.Read(ref state.Version);
        if (current > lastSeenVersion)
            return current;

        while (await state.SignalChannel.Reader.WaitToReadAsync(cancellationToken).ConfigureAwait(false))
        {
            while (state.SignalChannel.Reader.TryRead(out long notified))
            {
                if (notified > lastSeenVersion)
                    return notified;
            }

            current = Volatile.Read(ref state.Version);
            if (current > lastSeenVersion)
                return current;
        }

        return lastSeenVersion;
    }

    public void NotifyMessage(string fromPublicKey, string toPublicKey) =>
        NotifyPair(fromPublicKey, toPublicKey);

    public void NotifyKeyExchange(string fromPublicKey, string toPublicKey) =>
        NotifyPair(fromPublicKey, toPublicKey);

    private void NotifyPair(string from, string to)
    {
        Notify(from, null);
        Notify(to, null);
        Notify(from, to);
        Notify(to, from);
    }

    private void Notify(string owner, string? peer)
    {
        StreamState state = GetOrCreateState(BuildStreamKey(owner, peer));
        long next = Interlocked.Increment(ref state.Version);
        state.SignalChannel.Writer.TryWrite(next);
    }

    private StreamState GetOrCreateState(string key) =>
        _streams.GetOrAdd(key, _ => new StreamState());

    private static string BuildStreamKey(string owner, string? peer) =>
        peer is null ? $"inbox:{owner}" : $"conversation:{owner}|{peer}";
}
