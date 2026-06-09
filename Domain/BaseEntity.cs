namespace Domain;

public abstract class BaseEntity
{
    public DateTime CreatedAt
    {
        get; init;
    }

    public DateTime UpdatedAt
    {
        get; init;
    }
}
