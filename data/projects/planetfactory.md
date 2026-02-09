---
pageTitle: Project - PlanetFactory
heroImage: /assets/projects/planetfactory/planetfactoryplanets.webp
heroVideoUrl: ""
projectName: PlanetFactory
projectType: "[PVP FACTORY BUILDER - SOLO PROJECT]"
flairs:
  - Unity
  - C#
  - Networking (NGO)
  - Systems Architecture
projectInfo:
    Status: In Development
    Engine: Unity 6 (Addressables + NGO)
    Language: C#
    Duration: "IN PROGRESS"
codeLanguage: csharp
highlights:
  - Scalable, Addressables-powered data architecture built for modular asset management.
  - Squeezed networking down to 2-byte identifiers because syncing strings is a crime.
  - Implemented an event-driven destruction system using NetworkLists to sync 1,000+ hex tiles.
  - Developed an authoritative combat system with deterministic projectile path reconstruction.
---

PlanetFactory is an RTS factory builder set on a spherical hexagonal grid, focusing on automation, resource management, and real-time PVP combat. 

## Modular Generic Databases

To support a growing list of items and recipes without merge conflicts or runtime hitches, I developed a modular **Generic Database System**. Utilizing C# Generics and Unity Addressables, the system decouples data from logic, allowing for modular "Sub-Databases" that load asynchronously.

I implemented a centralized loading task to prevent race conditions; if ten different systems request the database at once, they all wait for the same single Addressable handle.

```csharp
// Generic base class for an Addressables-powered, type-safe database
public abstract class Database<TDatabase, TKey, TValue, TWrapper> : ScriptableObject
    where TDatabase : Database<TDatabase, TKey, TValue, TWrapper>
    where TWrapper : DatabaseValueWrapper<TValue>
{
    private static Task<TDatabase> loadingTask;

    // Ensures one single loading task handles multiple simultaneous calls
    public static Task<TDatabase> Load(string addressableKey)
    {
        if (_instance != null) return Task.FromResult(_instance);
        if (loadingTask != null) return loadingTask;

        loadingTask = LoadInternal(addressableKey);
        return loadingTask;
    }
}
```

## Networking: 2-Byte Identifiers

In a multiplayer RTS, bandwidth is the enemy. Syncing a string like `heavy_industrial_nuclear_battery` every time a drone moves is a waste. I built a wrapper around a `ushort` that handles all item networking. 

The system uses a reverse-lookup dictionary, so I can still use human-readable names in my terminal (`give_item iron_ore`), but the network only ever sees a 2-byte ID. It's fast, clean, and keeps the packets tiny.

```csharp
[Serializable]
public struct ItemID : INetworkSerializable, IEquatable<ItemID>
{
    public const ushort INVALID_ID = ushort.MaxValue;
    [SerializeField] private ushort id;

    // Reduces network overhead to exactly 2 bytes per item reference
    public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
        => serializer.SerializeValue(ref id);

    public static implicit operator ushort(ItemID itemID) => itemID.id;
}
```

## Authoritative Combat & Deterministic Pathing

Combat follows a strict **Server-Authoritative** model. To ensure visual parity without the bandwidth cost of streaming every position, the server calculates the trajectory "recipe"—things like arc height and subdivision counts—and sends these parameters to the client.

The client then reconstructs the exact same projectile path the server is using for its logic. This allows for smooth, local interpolation and high-fidelity "juice" while the server remains the ultimate source of truth for damage timing.

```csharp
// Server calculates the path parameters and tells the clients how to rebuild it
private IEnumerator ProcessAttackCoroutine(AttackArguments args, WeaponItemData weaponData)
{
    const int pathSubdivs = 15;
    const float pathArcHeight = 7.5f;

    // ... path logic ...
    
    float travelTime = length / weaponData.ProjectileSpeed;
    
    // Send the specific path parameters to the client for reconstruction
    RunVisualClientRpc(args, travelTime, pathSubdivs, pathArcHeight);

    // Server-side logic continues...
}
```

## Planetary Destruction & State Sync

Blowing things up in multiplayer is easy; keeping 1,000+ hex tiles in sync across the network is hard. I implemented the `PlanetDamageManager` using a `NetworkList<TileStatusInfo>`. 

By wrapping tile state into a custom bit-serializable struct, I can synchronize health and destruction states efficiently. The system is entirely event-driven—visuals only refresh when the network list actually reports a delta, keeping CPU overhead low even during heavy orbital bombardments.

```csharp
public struct TileStatusInfo : INetworkSerializable, IEquatable<TileStatusInfo>
{
    public int TileId;
    public int CurrentHealth;
    public bool IsDestroyed;

    public void NetworkSerialize<T>(BufferSerializer<T> serializer) where T : IReaderWriter
    {
        serializer.SerializeValue(ref TileId);
        serializer.SerializeValue(ref CurrentHealth);
        serializer.SerializeValue(ref IsDestroyed);
    }
}
```

## AOE Damage Falloff

I wrote a custom Area-of-Effect (AOE) system that calculates damage falloff based on hex-grid depth. This ensures that a nuke is most devastating at the impact point while tapering off naturally across the spherical surface using a customizable falloff curve.

```csharp
private void DealDamageToTiles(AttackArguments args, WeaponItemData weaponData, NetworkPlanet targetPlanet)
{
    int aoeDepth = weaponData.WeaponAOE;
    var aoeTiles = targetPlanet.HexSphere.GetNeighborsWithDepth(targetTile, aoeDepth);

    foreach (var kvp in aoeTiles)
    {
        // Calculate falloff: 1.0 at center, tapering to 0 at max AOE depth
        float falloffMultiplier = Mathf.Pow(1f - (kvp.Value / (float)(aoeDepth + 1)), weaponData.FalloffStrength);
        int damageToDeal = Mathf.RoundToInt(weaponData.Damage * falloffMultiplier);

        damageManager.ApplyDamageToTile(kvp.Key.Data.Id, damageToDeal);
    }
}
```

## Stress Testing with UniTerminal

PlanetFactory is the primary testing ground for **UniTerminal**. Whether I'm launching a `nuke_planet` command to stress-test the `NetworkList` synchronization or forcing network edge cases by manipulating planetary state, having a tool that speaks directly to my custom databases makes iteration actually fun instead of a chore.

![PlanetFactory stress test](/assets/projects/uniterminal/nuke_command.webp)