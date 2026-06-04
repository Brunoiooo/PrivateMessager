namespace Application.Interfaces;

public interface ISyncNotifier
{
    void NotifyMessage(string fromPublicKey, string toPublicKey);
    void NotifyKeyExchange(string fromPublicKey, string toPublicKey);
}
