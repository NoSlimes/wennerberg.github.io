// Inventory system with networked synchronization, item management, and save/load support
public class Inventory : NetworkBehaviour, ISaveable
{
    // Logging + Settings
    public static readonly DLogCategory LogInventory = new("Inventory", Color.cyan);
    [SerializeField] private InventoryAccess inventoryAccess = InventoryAccess.OwnerOnly;
    [SerializeField, Tooltip("Only applicable for proximity-based access")] private float proximityRange = 5f;
    [SerializeField] private int defaultSlots = 20;

    // Slot management
    private readonly NetworkVariable<int> additionalSlots = new(0);
    public virtual int SlotCount => defaultSlots + additionalSlots.Value;

    // Runtime state
    protected readonly List<ItemStack> inventoryItems = new();
    private List<ItemStack> inventoryItemsClient = new();
    public event Action OnInventoryItemsChanged;

    public string ComponentSaveID => "inventory";

    #region Networking & Access
    public override void OnNetworkSpawn() { /* Initialize slots on server */ }
    [ClientRpc] private void ReceiveInventoryClientRpc(ItemStack[] snapshot, ClientRpcParams rpcParams = default) { }
    [Rpc(SendTo.Server, RequireOwnership = false)] public void RequestInventoryServerRpc(RpcParams rpcParams = default) { }
    private void NotifyClientsOfChange() { }
    public bool CanClientAccess(ulong clientID) { /* Owner/Everyone + Proximity rules */ }
    #endregion

    #region Slot Swapping & Transfers
    [Rpc(SendTo.Server)] public void SwapSlotsServerRpc(int fromIndex, int toIndex) { }
    [Rpc(SendTo.Server)] public void SwapSlotToInventoryServerRpc(int fromIndex, ulong targetInventoryID, int toIndex = -1, RpcParams rpcParams = default) { }
    [Rpc(SendTo.Server)] public void MoveAmountToInventoryServerRpc(int fromIndex, ushort qty, ulong targetInventoryID, int toIndex = -1, RpcParams rpcParams = default) { }
    #endregion

    #region Item Addition
    public bool AddItem(ItemID item, ushort quantity, int? slotIndex = null) { }
    public bool AddItem(ItemStack stack, int? slotIndex = null) { }
    protected virtual bool AddItemInternal(ItemID item, ushort qty, int stackSize) { }
    protected virtual bool AddItemToSlotInternal(int slotIndex, ItemID item, ushort qty, int stackSize) { }
    public bool TryAddAsManyItemsAsPossible(ItemID item, ushort qty, out ushort remainder, int slotIndex = -1) { }
    #endregion

    #region Item Removal
    public bool RemoveItem(ItemID item, ushort qty, int? slotIndex = null) { }
    public bool RemoveItem(ItemStack stack) { }
    protected virtual bool RemoveItemInternal(ItemID item, ushort qty) { }
    protected virtual bool RemoveItemFromSlotInternal(int slotIndex, ItemID item, ushort qty) { }
    public void ClearItems() { }
    #endregion

    #region Instance Data Handling
    protected bool TryCreateInstanceData(ItemID itemID, out ItemInstanceData instanceData) { }
    protected bool TryGetOrCreateInstanceData(ItemStack itemStack, out ItemInstanceData instanceData) { }
    private TInstance CreateInstanceData<TData, TInstance>(TData itemData, Func<ItemID, Guid, TInstance> ctor) where TData : ItemData where TInstance : ItemInstanceData { }
    #endregion

    #region Queries & Utilities
    public ItemStack GetItem(int index, ulong clientID = ulong.MinValue, bool ignoreServerRestriction = false) { }
    public ItemStack[] GetItems(ulong clientID = ulong.MinValue, bool ignoreServerRestriction = false) { }
    public void SetSlot(int index, ItemStack slot) { }
    #endregion

    #region Save/Load
    public object CaptureState() { /* Convert to serializable data */ }
    public void RestoreState(object data) { /* Rebuild inventory from save */ }
    [Serializable] public record ItemStackData { public ushort ItemId; public ushort Quantity; public Guid InstanceId; }
    [Serializable] public record InventorySaveData { public ItemStackData[] Items; public int AdditionalSlots; }
    #endregion
}

// Access rules for inventory interactions
public enum InventoryAccess
{
    OwnerOnly,
    Everyone,
    OwnerOnlyProximity,
    EveryoneProximity
}
