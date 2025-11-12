/// <summary>
/// Server-authoritative inventory with safe client access rules and
/// convenient RPCs for requesting and synchronizing snapshots.
/// Designed for multiplayer games using Unity Netcode (NGO).
/// </summary>
public class Inventory : NetworkBehaviour, ISaveable
{
    // Public configuration (serialized in editor)
    [SerializeField] private InventoryAccess inventoryAccess = InventoryAccess.OwnerOnly;
    [SerializeField] private int defaultSlots = 20;

    // Networked state: number of extra slots (server-owned)
    private readonly NetworkVariable<int> additionalSlots = new(0);
    public int SlotCount => defaultSlots + additionalSlots.Value;

    // Runtime state (server authoritative)
    protected readonly List<ItemStack> inventoryItems = new();
    public event Action OnInventoryItemsChanged;

    // Simple lifecycle hook used on spawn to initialize server-side state
    public override void OnNetworkSpawn()
    {
        if (IsServer)
        {
            // Ensure inventory is initialized to SlotCount
            while (inventoryItems.Count < SlotCount)
                inventoryItems.Add(new ItemStack());
        }
    }

    // --------------------- Networking API ---------------------
    // Servers send snapshots to clients that are allowed to view the inventory.
    [ClientRpc]
    private void ReceiveInventoryClientRpc(ItemStack[] snapshot, ClientRpcParams rpcParams = default)
    {
        // client-side UI would receive and render this snapshot
        OnInventoryItemsChanged?.Invoke();
    }

    // Clients may request a full snapshot; the server validates permissions.
    [Rpc(SendTo.Server, RequireOwnership = false)]
    public void RequestInventoryServerRpc(RpcParams rpcParams = default)
    {
        // Server receives request, validates and responds via ReceiveInventoryClientRpc
    }

    // High-level helpers (signatures shown for clarity)
    public bool AddItem(ItemID item, ushort quantity, int? slotIndex = null) => false; // adds items (server only)
    public bool RemoveItem(ItemID item, ushort quantity, int? slotIndex = null) => false; // removes items (server only)

    // Swapping & transfer helpers (server RPCs)
    [Rpc(SendTo.Server)] public void SwapSlotsServerRpc(int fromIndex, int toIndex) { }
    [Rpc(SendTo.Server)] public void MoveAmountToInventoryServerRpc(int fromIndex, ushort qty, ulong targetInventoryID, int toIndex = -1, RpcParams rpcParams = default) { }

    // Save/restore contract
    public object CaptureState() { return null; }
    public void RestoreState(object data) { }
}

public enum InventoryAccess
{
    OwnerOnly,
    Everyone,
    OwnerOnlyProximity,
    EveryoneProximity
}
