using Application.Interfaces;

namespace Api.Realtime;

internal sealed class SyncNotificationHubAdapter(SyncNotificationHub hub) : ISyncNotifier
{
    public void NotifyMessage(string fromPublicKey, string toPublicKey) =>
        hub.NotifyMessage(fromPublicKey, toPublicKey);

    public void NotifyKeyExchange(string fromPublicKey, string toPublicKey) =>
        hub.NotifyKeyExchange(fromPublicKey, toPublicKey);
}
