using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using UnityEngine;
using NoSlimes.Logging;

namespace NoSlimes.ObjectPools
{
    [DefaultExecutionOrder(-1)]
    public class ObjectPoolManager : MonoBehaviour
    {
        private readonly static Dictionary<string, List<IPoolable>> pools = new();
        private readonly static Dictionary<string, GameObject> poolPrefabs = new();
        private readonly static Dictionary<string, Transform> poolParents = new();

        private static Transform poolBaseParent;

        public static ReadOnlyDictionary<string, List<IPoolable>> Pools => new(pools);
        public static ReadOnlyDictionary<string, GameObject> PoolPrefabs => new(poolPrefabs);
        public static ReadOnlyDictionary<string, Transform> PoolParents => new(poolParents);

        private void Awake()
        {
            pools.Clear();
            poolPrefabs.Clear();
            poolParents.Clear();
        }

        /// <summary>
        /// Adds a new pool of GameObjects, with desired name and pool size
        /// </summary>
        /// <param name="poolName">The name of the new pool</param>
        /// <param name="prefab">The prefab of the GameObject to make a pool of</param>
        /// <param name="poolSize">The size of the new pool</param>
        public static void AddPool(string poolName, GameObject prefab, int poolSize)
        {
            poolBaseParent = poolBaseParent != null ? poolBaseParent : new GameObject("ObjectPools").transform;

            if (!pools.ContainsKey(poolName))
            {
                pools[poolName] = new List<IPoolable>();
            }

            Transform poolParent = new GameObject(poolName).transform;
            poolParent.transform.SetParent(poolBaseParent);

            for (int i = 0; i < poolSize; i++)
            {
                GameObject go = Object.Instantiate(prefab, poolParent);
                go.SetActive(false);

                IPoolable pooledSpawnable = go.GetComponent<IPoolable>();

                pools[poolName].Add(pooledSpawnable);

                pooledSpawnable.OnAddToPool(poolParent);
            }

            poolPrefabs[poolName] = prefab;
            poolParents[poolName] = poolParent;
        }

        /// <summary>
        /// Removes the given pool along with all of its objects
        /// </summary>
        /// <param name="poolName">The name of the pool to remove</param>
        public static void RemovePool(string poolName)
        {
            if (pools.ContainsKey(poolName))
            {
                Transform poolParent = poolBaseParent.Find(poolName);

                for (int i = 0; i < poolParent.childCount; i++)
                {
                    Object.Destroy(poolParent.GetChild(0).gameObject);
                }
                Object.Destroy(poolParent.gameObject);

                pools.Remove(poolName);
                poolPrefabs.Remove(poolName);
                poolParents.Remove(poolName);
            }
            else
            {
                DLogger.LogDevWarning($"No object pool with name \"{poolName}\" exists!");
            }
        }

        /// <summary>
        /// Gets an GameObject from the pool
        /// </summary>
        /// <param name="poolName">The name of the pool to get an GameObject from</param>
        /// <returns>Returns a GameObject from the pool, if there is one available</returns>
        public static GameObject GetPooledObject(string poolName)
        {
            if (pools.ContainsKey(poolName) && pools[poolName].Count > 0)
            {
                for (int i = 0; i < pools[poolName].Count; i++)
                {
                    if (!pools[poolName][i].GameObject.activeInHierarchy)
                    {
                        return pools[poolName][i].GameObject;
                    }
                }

                DLogger.LogDevWarning($"All objects in pool \"{poolName}\" are active - pool depleted");
                return null;
            }
            else
            {
                DLogger.LogDevWarning($"No object pool with name \"{poolName}\" exists!");
            }
            return null;
        }

        public static bool HasPool(string poolName) => pools.ContainsKey(poolName);
        public static bool HasPool(GameObject poolObject) => PoolPrefabs.Values.Contains(poolObject);
    }

    public static class ObjectPoolUtilities
    {
        public static T SpawnPoolable<T>(string poolName, Vector3 position = default, Quaternion rotation = default) where T : IPoolable
        {
            GameObject obj = ObjectPoolManager.GetPooledObject(poolName);

            if (obj != null)
            {
                if (obj.TryGetComponent(out T spawnedPoolable))
                {
                    spawnedPoolable.GameObject.transform.SetPositionAndRotation(position, rotation);
                    spawnedPoolable.OnSpawn();
                    return spawnedPoolable;
                }
                return default;
            }
            return default;
        }

        public static T SpawnPoolable<T>(GameObject prefab, Vector3 position = default, Quaternion rotation = default) where T : IPoolable
        {
            string poolName = GetPoolNameFromPrefab(prefab);
            return SpawnPoolable<T>(poolName, position, rotation);
        }

        public static bool TrySpawnPoolable<T>(string poolName, out T poolable, Vector3 position = default, Quaternion rotation = default) where T : IPoolable
        {
            poolable = SpawnPoolable<T>(poolName, position, rotation);
            return poolable != null;
        }

        public static bool TrySpawnPoolable<T>(GameObject prefab, out T poolable, Vector3 position = default, Quaternion rotation = default) where T : IPoolable
        {
            if (prefab == null)
            {
                poolable = default;
                return false;
            }

            string poolName = GetPoolNameFromPrefab(prefab);
            poolable = SpawnPoolable<T>(poolName, position, rotation);
            return poolable != null;
        }

        public static void RespawnPoolable<T>(T poolable, Vector3 position = default, Quaternion rotation = default) where T : IPoolable
        {
            if(poolable == null)
                return;

            poolable.ReturnToPool();
            
            poolable.GameObject.transform.SetPositionAndRotation(position, rotation);
            poolable.OnSpawn();
        }

        public static string GetPoolNameFromPrefab(GameObject prefab)
        {
            foreach (System.Collections.Generic.KeyValuePair<string, GameObject> kvp in ObjectPoolManager.PoolPrefabs)
            {
                if (kvp.Value == prefab)
                {
                    return kvp.Key;
                }
            }

            return string.Empty;
        }

        public static Transform GetPoolParentFromPrefab(GameObject prefab)
        {
            string poolName = GetPoolNameFromPrefab(prefab);

            foreach (System.Collections.Generic.KeyValuePair<string, Transform> kvp in ObjectPoolManager.PoolParents)
            {
                if (kvp.Key == poolName)
                {
                    return kvp.Value;
                }
            }

            return null;
        }
    }

    [System.Serializable]
    public class PoolSettings
    {
        [SerializeField] private GameObject poolPrefab;
        [SerializeField] private int poolSize;

        public string PoolName
        {
            get
            {
                string poolName = "Invalid Pool";
                
                if (poolPrefab)
                    poolName = poolPrefab.name;

                return poolName;
            }
        }

        public GameObject PoolPrefab => poolPrefab;
        public int PoolSize => poolSize;

        public PoolSettings(GameObject poolPrefab, int poolSize)
        {
            this.poolPrefab = poolPrefab;
            this.poolSize = poolSize;
        }

        public void SetPrefab(GameObject newPrefab) => poolPrefab = newPrefab;
        public void SetSize(int newSize) => poolSize = newSize;

        public static bool operator ==(PoolSettings x, PoolSettings y)
        {
            if (ReferenceEquals(x, null) && ReferenceEquals(y, null)) return true;
            if (ReferenceEquals(x, null) || ReferenceEquals(y, null)) return false;

            return x.PoolPrefab == y.poolPrefab;
        }

        public static bool operator !=(PoolSettings x, PoolSettings y)
        {
            return !(x == y);
        }
    }
}