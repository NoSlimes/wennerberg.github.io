using Newtonsoft.Json.Linq;
using NoSlimes.Gameplay.Util.Networking;
using NoSlimes.Logging;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using Unity.Netcode;
using UnityEngine;
using static NoSlimes.Gameplay.Inventory;

namespace NoSlimes.Gameplay
{
    public enum InventoryAccess
    {
        OwnerOnly,
        Everyone,
        OwnerOnlyProximity,
        EveryoneProximity
    }

    public class Inventory : NetworkBehaviour, ISaveable
    {
        public static readonly DLogCategory LogInventory = new("Inventory", Color.cyan);

        [Header("Inventory Settings")]
        [SerializeField] private InventoryAccess inventoryAccess = InventoryAccess.OwnerOnly;

        [SerializeField, Tooltip("Only applicable if using a proximity based access value")]
        private float proximityRange = 5f;

        [Header("Slots")]
        [SerializeField] private int defaultSlots = 20;

        private readonly NetworkVariable<int> additionalSlots = new(0);
        public virtual int SlotCount => defaultSlots + additionalSlots.Value;

        public string ComponentSaveID => "inventory";

        protected readonly List<ItemStack> inventoryItems = new();

        // Client-side copy of inventory items for UI updates
        private List<ItemStack> inventoryItemsClient = new();
        public event Action OnInventoryItemsChanged;

        #region Unity Lifecycle
        public override void OnNetworkSpawn()
        {
            base.OnNetworkSpawn();

            if (IsServer && inventoryItems.Count == 0)
            {
                for (int i = 0; i < SlotCount; i++)
                    inventoryItems.Add(new ItemStack { ItemID = new ItemID(0), Quantity = 0 });

                NotifyClientsOfChange();
                DLog.DevLog($"Initialized inventory with {SlotCount} slots.", this, LogInventory);
            }
        }
        #endregion

        #region Inventory Sync
        [ClientRpc]
        private void ReceiveInventoryClientRpc(ItemStack[] inventorySnapshot, ClientRpcParams clientRpcParams = default)
        {
            inventoryItemsClient = new List<ItemStack>(inventorySnapshot);
            OnInventoryItemsChanged?.Invoke();
        }

        public void SendInventoryToClient(ulong clientId)
        {
            if (!CanClientAccess(clientId))
            {
                DLog.DevLogWarning($"Client {clientId} tried to access inventory without permission.", this, LogInventory);
                return;
            }

            ItemStack[] snapshot = inventoryItems.ToArray();

            ClientRpcParams rpcParams = new()
            {
                Send = new ClientRpcSendParams { TargetClientIds = new ulong[] { clientId } }
            };

            ReceiveInventoryClientRpc(snapshot, rpcParams);
        }

        [Rpc(SendTo.Server, RequireOwnership = false)]
        public void RequestInventoryServerRpc(RpcParams rpcParams = default)
        {
            ulong clientId = rpcParams.Receive.SenderClientId;

            SendInventoryToClient(clientId);
        }

        protected void NotifyClientsOfChange()
        {
            foreach (ulong clientId in NetworkManager.ConnectedClientsIds)
            {
                if (CanClientAccess(clientId))
                {
                    SendInventoryToClient(clientId);
                }
            }
        }
        #endregion

        [Rpc(SendTo.Server)]
        public void SwapSlotsServerRpc(int fromIndex, int toIndex)
        {
            SwapSlotsInternal(fromIndex, toIndex);
        }
        private void SwapSlotsInternal(int fromIndex, int toIndex)
        {
            if (!IsServer)
            {
                DLog.DevLogWarning("SwapSlotsInternal can only be called on the server.", this, LogInventory);
                return;
            }

            InventoryUtil.TransferItemToSlot(this, fromIndex, this, toIndex);
            NotifyClientsOfChange();
        }

        [Rpc(SendTo.Server)]
        public void SwapSlotToInventoryServerRpc(int fromIndex, ulong targetInventoryNetworkID, int toIndex = -1, RpcParams rpcParams = default)
        {
            ulong senderClientId = rpcParams.Receive.SenderClientId;

            if (!this.CanClientAccess(senderClientId))
            {
                DLog.DevLogWarning($"Client {senderClientId} tried to send from inventory they can't access.", this, LogInventory);
                return;
            }

            NetworkObject networkObject = NetworkManager.SpawnManager.SpawnedObjects[targetInventoryNetworkID];
            if (networkObject == null)
            {
                DLog.DevLogError($"Target inventory with Network ItemID {targetInventoryNetworkID} not found.", this, LogInventory);
                return;
            }

            Inventory targetInventory = networkObject.GetComponent<Inventory>();
            if (targetInventory == null)
            {
                DLog.DevLogError($"Target inventory component not found on NetworkObject with ItemID {targetInventoryNetworkID}.", this, LogInventory);
                return;
            }

            if (!targetInventory.CanClientAccess(senderClientId))
            {
                DLog.DevLogWarning($"Client {senderClientId} tried to send to inventory they can't access.", this, LogInventory);
                return;
            }

            SwapSlotToInventoryInternal(fromIndex, targetInventory, toIndex);
        }

        [Rpc(SendTo.Server)]
        public void MoveAmountToInventoryServerRpc(int fromIndex, ushort quantity, ulong targetInventoryNetworkID, int toIndex = -1, RpcParams rpcParams = default)
        {
            ulong senderClientId = rpcParams.Receive.SenderClientId;

            if (!this.CanClientAccess(senderClientId))
            {
                DLog.DevLogWarning($"Client {senderClientId} tried to send from inventory they can't access.", this, LogInventory);
                return;
            }

            if (!IsServer)
            {
                DLog.DevLogWarning("MoveAmountToInventoryServerRpc called on client instead of server.", this, LogInventory);
                return;
            }

            if (fromIndex < 0 || fromIndex >= inventoryItems.Count)
            {
                DLog.DevLogWarning($"Invalid fromIndex {fromIndex}.", this, LogInventory);
                return;
            }

            ItemStack sourceSlot = inventoryItems[fromIndex];
            if (sourceSlot.Quantity < quantity || quantity == 0)
            {
                DLog.DevLogWarning($"Not enough quantity in slot {fromIndex} to move {quantity}.", this, LogInventory);
                return;
            }

            if (!NetworkManager.SpawnManager.SpawnedObjects.TryGetValue(targetInventoryNetworkID, out NetworkObject networkObject))
            {
                DLog.DevLogError($"Target inventory with Network ItemID {targetInventoryNetworkID} not found.", this, LogInventory);
                return;
            }

            Inventory targetInventory = networkObject.GetComponentInChildren<Inventory>();
            if (targetInventory == null)
            {
                DLog.DevLogError($"Target inventory component not found on NetworkObject with ItemID {targetInventoryNetworkID}.", this, LogInventory);
                return;
            }

            if (!targetInventory.CanClientAccess(senderClientId))
            {
                DLog.DevLogWarning($"Client {senderClientId} tried to send to inventory they can't access.", this, LogInventory);
                return;
            }

            targetInventory.TryAddAsManyItemsAsPossible(sourceSlot.ItemID, quantity, out ushort remainder, toIndex);
            if (remainder > 0)
            {
                DLog.DevLogWarning($"Could not move all items. Requested: {quantity}, Moved: {quantity - remainder}, Remaining: {remainder}", this, LogInventory);
            }

            RemoveItemAtSlot(fromIndex, sourceSlot.ItemID, (ushort)(quantity - remainder));
        }

        public bool CanClientAccess(ulong clientID)
        {
            switch (inventoryAccess)
            {
                case InventoryAccess.OwnerOnly:
                    return OwnerClientId == clientID;
                case InventoryAccess.Everyone:
                    return true;
                case InventoryAccess.OwnerOnlyProximity:
                    return OwnerClientId == clientID && IsClientNearby(clientID);
                case InventoryAccess.EveryoneProximity:
                    return IsClientNearby(clientID);
                default:
                    DLog.DevLogWarning($"Unknown inventory access type: {inventoryAccess}", this, LogInventory);
                    return false;
            }
        }

        public float GetProximityRange()
        {
            return proximityRange;
        }

        private bool IsClientNearby(ulong clientID)
        {
            NetworkObject playerObject = NetworkManager.SpawnManager.GetPlayerNetworkObject(clientID);

            if (playerObject == null)
            {
                DLog.DevLogWarning($"Player with Client ItemID {clientID} not found.", this, LogInventory);
                return false;
            }

            float distance = Vector3.Distance(transform.position, playerObject.transform.position);
            return distance <= proximityRange;
        }

        private void SwapSlotToInventoryInternal(int fromIndex, Inventory target, int toIndex = -1)
        {
            if (!IsServer)
            {
                DLog.DevLogWarning("SwapSlotToInventoryInternal can only be called on the server.", this, LogInventory);
                return;
            }

            if (target == null)
            {
                DLog.DevLogError("Target inventory is null.", this, LogInventory);
                return;
            }

            InventoryUtil.TransferItemToSlot(this, fromIndex, target, toIndex);
            NotifyClientsOfChange();
        }

        #region Item Addition
        public bool AddItem(ItemID item, ushort quantity, int? slotIndex = null)
        {
            if (!IsServer)
            {
                DLog.DevLogWarning("AddItem can only be called on the server.", this, LogInventory);
                return false;
            }

            if (quantity == 0)
                return true;

            ItemData itemData = ItemDatabaseSO.Instance.GetItemByID(item);
            if (itemData == null)
            {
                DLog.DevLogError($"Item {item.ID} not found in database.", this, LogInventory);
                return false;
            }

            ushort stackSize = itemData.StackSize;

            if (slotIndex.HasValue)
            {
                return AddItemToSlotInternal(slotIndex.Value, item, quantity, stackSize);
            }

            return AddItemInternal(item, quantity, stackSize);
        }

        public bool AddItem(ItemStack stackToAdd, int? slotIndex = null)
        {
            if (!IsServer)
            {
                DLog.DevLogWarning("AddItem can only be called on the server.", this, LogInventory);
                return false;
            }

            if (stackToAdd.ItemID == ItemID.INVALID_ID || stackToAdd.Quantity == 0)
                return true;

            ItemData itemData = ItemDatabaseSO.Instance.GetItemByID(stackToAdd.ItemID);
            if (itemData == null)
            {
                DLog.DevLogError($"Item {stackToAdd.ItemID.ID} not found in database.", this, LogInventory);
                return false;
            }

            if (stackToAdd.HasInstanceData)
            {
                int emptySlotIndex = inventoryItems.FindIndex(slot => slot.ItemID == ItemID.INVALID_ID);
                if (emptySlotIndex != -1)
                {
                    inventoryItems[emptySlotIndex] = stackToAdd;
                    NotifyClientsOfChange();
                    return true;
                }
                return false; 
            }

            return AddItem(stackToAdd.ItemID, stackToAdd.Quantity, slotIndex);
        }

        protected virtual bool AddItemInternal(ItemID itemId, ushort quantity, int stackSize)
        {
            ushort remaining = quantity;
            ItemData itemData = ItemDatabaseSO.Instance.GetItemByID(itemId);
            if (itemData == null)
            {
                DLog.DevLogError($"Item {itemId.ID} not found in database.", this, LogInventory);
                return false;
            }

            if (stackSize > 1)
            {
                for (int i = 0; i < inventoryItems.Count && remaining > 0; i++)
                {
                    var slot = inventoryItems[i];

                    if (slot.ItemID == itemId && !slot.HasInstanceData && slot.Quantity < stackSize)
                    {
                        ushort space = (ushort)(stackSize - slot.Quantity);
                        ushort toAdd = (ushort)Mathf.Min(space, remaining);

                        if (toAdd > 0)
                        {
                            slot.Quantity += toAdd;
                            inventoryItems[i] = slot;
                            remaining -= toAdd;
                            DLog.DevLog($"Stacked {toAdd} of item {itemId.ID} in slot {i}.", this, LogInventory);
                        }
                    }
                }
            }

            for (int i = 0; i < inventoryItems.Count && remaining > 0; i++)
            {
                var slot = inventoryItems[i];
                if (slot.ItemID == ItemID.INVALID_ID)
                {
                    if (TryCreateInstanceData(itemId, out var instanceData))
                    {
                        // --- This is a UNIQUE item ---

                        slot.ItemID = itemId;
                        slot.Quantity = 1;
                        slot.InstanceID = instanceData.InstanceID;
                        inventoryItems[i] = slot;
                        remaining--;
                        DLog.DevLog($"Added INSTANCED item {itemId.ID} to new slot {i}.", this, LogInventory);
                    }
                    else
                    {
                        // --- This is a STACKABLE item ---

                        ushort toAdd = (ushort)Mathf.Min(stackSize, remaining);
                        slot.ItemID = itemId;
                        slot.Quantity = toAdd;
                        slot.InstanceID = Guid.Empty;
                        inventoryItems[i] = slot;
                        remaining -= toAdd;
                        DLog.DevLog($"Added {toAdd} of STACKABLE item {itemId.ID} to new slot {i}.", this, LogInventory);
                    }
                }
            }

            NotifyClientsOfChange();
            return remaining == 0;
        }

        protected virtual bool AddItemToSlotInternal(int slotIndex, ItemID item, ushort quantity, int stackSize)
        {
            if (slotIndex < 0 || slotIndex >= inventoryItems.Count)
            {
                DLog.DevLogWarning($"Invalid slot index {slotIndex}.", this, LogInventory);
                return false;
            }

            ItemStack slot = inventoryItems[slotIndex];

            if (TryCreateInstanceData(item, out ItemInstanceData instanceData))
            {
                ushort toAdd = (ushort)Mathf.Min(quantity, stackSize);
                if (toAdd == 0) return false;

                if (instanceData.InstanceID != Guid.Empty && toAdd > 1)
                {
                    DLog.DevLogWarning($"Cannot add a stack of instanced items to a single slot. Adding one.", this, LogInventory);
                    toAdd = 1;
                }

                slot.ItemID = item;
                slot.Quantity = toAdd;
                slot.InstanceID = instanceData.InstanceID;
                inventoryItems[slotIndex] = slot;

                DLog.DevLog($"Added {toAdd} of item {item.ID} to empty slot {slotIndex}.", this, LogInventory);
                NotifyClientsOfChange();
                return toAdd == quantity;
            }

            if (slot.ItemID == item && !slot.HasInstanceData)
            {
                ushort space = (ushort)(stackSize - slot.Quantity);
                ushort toAdd = (ushort)Mathf.Min(space, quantity);

                if (toAdd > 0)
                {
                    slot.Quantity += toAdd;
                    inventoryItems[slotIndex] = slot;
                    DLog.DevLog($"Stacked {toAdd} of item {item.ID} onto slot {slotIndex}.", this, LogInventory);
                    NotifyClientsOfChange();
                }

                return toAdd == quantity;
            }

            DLog.DevLogWarning($"Slot {slotIndex} contains another item or is an instanced item. Cannot add {item.ID}.", this, LogInventory);
            return false;
        }

        public bool AddItemAtSlot(int slotIndex, ItemID item, ushort quantity) => AddItem(item, quantity, slotIndex);
        public bool TryAddAsManyItemsAsPossible(ItemID item, ushort quantity, out ushort remainder, int slotIndex = -1)
        {
            remainder = quantity;

            if (!IsServer)
            {
                DLog.DevLogWarning("TryAddAsManyItemsAsPossible must be called on server.", this, LogInventory);
                return false;
            }

            if (slotIndex >= 0 && (slotIndex < 0 || slotIndex >= SlotCount))
            {
                DLog.DevLogWarning($"Invalid slot index {slotIndex}. Must be between 0 and {SlotCount - 1}.", this, LogInventory);
                return false;
            }

            if (slotIndex == -1)
            {
                if (AddItem(item, quantity))
                {
                    remainder = 0;
                    return true;
                }

                for (int i = 0; i < quantity; i++)
                {
                    if (AddItem(item, 1))
                    {
                        remainder--;
                    }
                    else
                    {
                        break;
                    }
                }
            }
            else
            {
                if (AddItemAtSlot(slotIndex, item, quantity))
                {
                    remainder = 0;
                    return true;
                }

                for (int i = 0; i < quantity; i++)
                {
                    if (AddItemAtSlot(slotIndex, item, 1))
                    {
                        remainder--;
                    }
                    else
                    {
                        break;
                    }
                }
            }

            DLog.DevLog($"Attempted to add {quantity} of {item.ID}, remainder: {remainder}", this, LogInventory);

            NotifyClientsOfChange();
            return remainder == 0;
        }

        #endregion

        #region Item Removal
        public bool RemoveItem(ItemID item, ushort quantity, int? slotIndex = null)
        {
            if (!IsServer)
            {
                DLog.DevLogWarning("RemoveItem can only be called on the server.", this, LogInventory);
                return false;
            }

            if (quantity == 0)
                return true;

            if (slotIndex.HasValue)
            {
                return RemoveItemFromSlotInternal(slotIndex.Value, item, quantity);
            }

            return RemoveItemInternal(item, quantity);
        }

        public bool RemoveItem(ItemStack stackToRemove)
        {
            if (!IsServer)
            {
                DLog.DevLogWarning("RemoveItem can only be called on the server.", this, LogInventory);
                return false;
            }

            if (stackToRemove.ItemID == ItemID.INVALID_ID || stackToRemove.Quantity == 0)
            {
                DLog.DevLogWarning("Invalid item stack provided for removal.", this, LogInventory);
                return false;
            }

            if (stackToRemove.HasInstanceData)
            {
                int index = inventoryItems.FindIndex(s => s.InstanceID == stackToRemove.InstanceID);
                if (index != -1)
                {
                    return RemoveItemFromSlotInternal(index, stackToRemove.ItemID, stackToRemove.Quantity);
                }
                else
                {
                    DLog.DevLogWarning($"Could not find item with InstanceID {stackToRemove.InstanceID} to remove.", this, LogInventory);
                    return false;
                }
            }

            return RemoveItem(stackToRemove.ItemID, stackToRemove.Quantity);
        }

        protected virtual bool RemoveItemInternal(ItemID item, ushort quantity)
        {
            // Count total quantity available
            ushort totalAvailable = 0;
            for (int i = 0; i < inventoryItems.Count; i++)
            {
                if (inventoryItems[i].ItemID == item)
                {
                    totalAvailable += inventoryItems[i].Quantity;
                    if (totalAvailable >= quantity)
                        break;
                }
            }

            if (totalAvailable < quantity)
            {
                DLog.DevLogWarning($"Not enough of item {item.ID} to remove. Requested: {quantity}, Available: {totalAvailable}", this, LogInventory);
                return false;
            }

            // Remove from stacks
            ushort remainingToRemove = quantity;
            for (int i = 0; i < inventoryItems.Count && remainingToRemove > 0; i++)
            {
                ItemStack slot = inventoryItems[i];
                if (slot.ItemID == item)
                {
                    if (slot.Quantity <= remainingToRemove)
                    {
                        remainingToRemove -= slot.Quantity;

                        if (slot.HasInstanceData)
                            ItemInstanceRegistry.Instance.UnregisterReference(slot.InstanceID);

                        slot.ItemID = ItemID.INVALID_ID;
                        slot.InstanceID = Guid.Empty;
                        slot.Quantity = 0;
                    }
                    else
                    {
                        slot.Quantity -= remainingToRemove;
                        remainingToRemove = 0;
                    }

                    inventoryItems[i] = slot;

                    DLog.DevLog($"Removed from slot {i}. Remaining to remove: {remainingToRemove}", this, LogInventory);
                }
            }

            NotifyClientsOfChange();
            return true;
        }
        protected virtual bool RemoveItemFromSlotInternal(int slotIndex, ItemID item, ushort quantity)
        {
            int index = slotIndex;
            if (index < 0 || index >= inventoryItems.Count)
            {
                DLog.DevLogWarning($"Invalid slot index {index}.", this, LogInventory);
                return false;
            }

            ItemStack slot = inventoryItems[index];

            if (slot.ItemID != item)
            {
                DLog.DevLogWarning($"Slot {index} does not contain expected item {item.ID}. Found: {slot.ItemID.ID}", this, LogInventory);
                return false;
            }

            if (slot.Quantity < quantity)
            {
                DLog.DevLogWarning($"Not enough items in slot {index} to remove. Requested: {quantity}, Available: {slot.Quantity}", this, LogInventory);
                return false;
            }

            slot.Quantity -= quantity;

            if (slot.Quantity == 0)
            {
                if (slot.HasInstanceData)
                    ItemInstanceRegistry.Instance.UnregisterReference(slot.InstanceID);

                slot.ItemID = ItemID.INVALID_ID;
                slot.InstanceID = Guid.Empty;
            }

            inventoryItems[index] = slot;

            DLog.DevLog($"Removed {quantity} of item {item.ID} from slot {index}.", this, LogInventory);
            NotifyClientsOfChange();
            return true;
        }

        //Legacy method for compatibility
        public bool RemoveItemAtSlot(int slotIndex, ItemID expectedItem, ushort quantity) => RemoveItem(expectedItem, quantity, slotIndex);
       
        public void ClearItems()
        {
            if (!IsServer)
            {
                DLog.DevLogWarning("ClearItems can only be called on the server.", this, LogInventory);
                return;
            }

            for (int i = 0; i < inventoryItems.Count; i++)
            {
                var slot = inventoryItems[i];
                if (slot.HasInstanceData)
                {
                    ItemInstanceRegistry.Instance.UnregisterReference(slot.InstanceID);
                }
                slot.ItemID = ItemID.INVALID_ID;
                slot.Quantity = 0;
                slot.InstanceID = Guid.Empty;

                inventoryItems[i] = slot;
            }

            DLog.DevLog("Cleared all items from inventory.", this, LogInventory);
            NotifyClientsOfChange();
        }
        
        #endregion

        protected bool TryCreateInstanceData(ItemID itemID, out ItemInstanceData instanceData)
        {
            instanceData = null;
            if (itemID == ItemID.INVALID_ID)
                return false;

            ItemStack tempStack = new() { ItemID = itemID, Quantity = 1 };
            return TryGetOrCreateInstanceData(tempStack, out instanceData);
        }

        protected bool TryGetOrCreateInstanceData(ItemStack itemStack, out ItemInstanceData instanceData)
        {
            instanceData = null;

            if (itemStack.ItemID == ItemID.INVALID_ID)
                return false;

            var itemData = ItemDatabaseSO.Instance.GetItemByID(itemStack.ItemID);

            if (ItemInstanceRegistry.Instance.TryGetInstanceData(itemStack.InstanceID, out instanceData))
                return true;

            switch (itemData)
            {
                case ToolData toolData:
                    instanceData = CreateInstanceData(toolData, (itemID, id) => new ToolInstanceData(itemID, id, toolData.Durability));
                    break;

                case ConsumableItemData consumableData:
                    instanceData = null;
                    // Handle consumable creation
                    break;

                    //case MiscellaneousItemData miscData:
                    //    // Handle misc creation
                    //    break;

                    //case EquipmentData equipmentData:
                    //    // Handle equipment creation
                    //    break;
            }

            return instanceData != null;
        }

        private TInstance CreateInstanceData<TData, TInstance>(TData itemData, Func<ItemID, Guid, TInstance> constructorFunc) where TData : ItemData where TInstance : ItemInstanceData
        {
            if (itemData is null)
            {
                DLog.DevLogError($"Item data type mismatch. Expected {typeof(TData)}, got {itemData.GetType()}.", this, LogInventory);
                return null;
            }

            Guid instanceID = Guid.NewGuid();
            TInstance instanceData = constructorFunc(itemData.ItemID, instanceID);
            ItemInstanceRegistry.Instance.RegisterInstance(new NetworkGuid(instanceID), instanceData);

            return instanceData;
        }

        //public bool GetInstanceData(Guid instanceID, out ItemInstanceData instanceData)
        //{
        //    if (ItemInstanceRegistry.Instance.TryGetInstanceData(instanceID, out instanceData))
        //        return true;

        //    DLog.DevLogWarning($"Instance data with ItemID {instanceID} not found.", this, LogInventory);
        //    return false;
        //}

        public ItemStack GetItem(int index, ulong clientID = ulong.MinValue, bool ignoreServerRestriction = false)
        {
            if (clientID == ulong.MinValue)
                clientID = NetworkManager.LocalClientId;

            if (IsServer && !ignoreServerRestriction && !CanClientAccess(clientID))
            {
                DLog.DevLogWarning($"Server attempted to get inventory item for client {clientID} without access.", this, LogInventory);
                return new ItemStack { ItemID = ItemID.INVALID_ID, Quantity = 0 };
            }

            if (!IsServer && !CanClientAccess(clientID))
            {
                DLog.DevLogWarning($"Client {clientID} attempted to access inventory item without proper authority.", this, LogInventory);
                return new ItemStack { ItemID = ItemID.INVALID_ID, Quantity = 0 };
            }

            if (index < 0 || index >= SlotCount)
            {
                DLog.DevLogWarning($"GetItem index out of range: {index}", this, LogInventory);
                return new ItemStack { ItemID = ItemID.INVALID_ID, Quantity = 0 };
            }

            return IsServer ? inventoryItems[index] : inventoryItemsClient[index];
        }

        public ItemStack[] GetItems(ulong clientID = ulong.MinValue, bool ignoreServerRestriction = false)
        {
            if (clientID == ulong.MinValue)
                clientID = NetworkManager.LocalClientId;

            if (IsServer)
            {
                // If host acts like a client, and ignoreServerRestriction is false, apply access check. This is to prevent host from accessing client inventories without permission (eg. out of range, etc)
                if (!ignoreServerRestriction && NetworkManager.LocalClientId == clientID && !CanClientAccess(clientID))
                {
                    DLog.DevLogWarning($"Host (acting as client) tried to access inventory for client {clientID} without access.", this, LogInventory);
                    return Array.Empty<ItemStack>();
                }

                return inventoryItems.ToArray();
            }

            if (!CanClientAccess(clientID))
            {
                DLog.DevLogWarning($"Client {clientID} tried to access inventory without permission.", this, LogInventory);
                return Array.Empty<ItemStack>();
            }

            return inventoryItemsClient.ToArray();
        }

        public void SetSlot(int index, ItemStack slot)
        {
            if (!IsServer)
            {
                DLog.DevLogWarning("SetSlot can only be called on the server.", this, LogInventory);
                return;
            }

            if (index < 0 || index >= inventoryItems.Count)
            {
                DLog.DevLogWarning($"SetSlot index out of range: {index}", this, LogInventory);
                return;
            }

            inventoryItems[index] = slot;
        }

        public object CaptureState()
        {
            var serializableItems = new List<ItemStackData>();

            foreach (var runtimeStack in inventoryItems)
            {
                serializableItems.Add(new ItemStackData
                {
                    ItemId = runtimeStack.ItemID.ID,
                    Quantity = runtimeStack.Quantity,
                    InstanceId = runtimeStack.InstanceID
                });
            }

            return new InventorySaveData
            {
                Items = serializableItems.ToArray(),
                AdditionalSlots = additionalSlots.Value,
            };
        }

        public void RestoreState(object data)
        {
            inventoryItems.Clear();

            if (data is JObject jobj)
            {
                var saveData = jobj.ToObject<InventorySaveData>();

                additionalSlots.Value = saveData.AdditionalSlots;
                foreach (var itemData in saveData.Items)
                {
                    var newStack = new ItemStack
                    {
                        ItemID = new ItemID(itemData.ItemId),
                        Quantity = itemData.Quantity,
                        InstanceID = new NetworkGuid(itemData.InstanceId)
                    };

                    inventoryItems.Add(newStack);
                }
            }
            else
            {
                Debug.LogError($"Invalid data type for inventory state restoration. Expected a serializable object, but got {data?.GetType().Name}.", this);
            }

            NotifyClientsOfChange();
        }

        [Serializable]
        public record ItemStackData
        {
            public ushort ItemId;
            public ushort Quantity;
            public Guid InstanceId;
        }

        [Serializable]
        public record InventorySaveData
        {
            public ItemStackData[] Items;
            public int AdditionalSlots;
        }
    }
}


