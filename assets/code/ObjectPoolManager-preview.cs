// Core object pool manager for efficient GameObject reuse
public class ObjectPoolManager : MonoBehaviour
{
    private readonly static Dictionary<string, List<IPoolable>> pools = new();
    private readonly static Dictionary<string, GameObject> poolPrefabs = new();

    /// <summary>
    /// Adds a new pool of GameObjects with desired name and pool size
    /// </summary>
    public static void AddPool(string poolName, GameObject prefab, int poolSize)
    {
        // Create pool hierarchy and instantiate objects...
    }

    /// <summary>
    /// Gets an inactive GameObject from the specified pool
    /// </summary>
    public static GameObject GetPooledObject(string poolName)
    {
        // Find and return inactive pooled object...
    }
}

// Utility methods for easy pool interaction
public static class ObjectPoolUtilities
{
    public static T SpawnPoolable<T>(string poolName, Vector3 position = default) where T : IPoolable
    {
        // Get from pool and configure for spawn...
    }
}