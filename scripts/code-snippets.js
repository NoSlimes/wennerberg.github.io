// Interactive code snippets functionality
document.addEventListener('DOMContentLoaded', function() {
  initCodeSnippets();
});

function initCodeSnippets() {
  // Add syntax highlighting classes
  addSyntaxHighlighting();
  
  // Initialize expand buttons
  const expandButtons = document.querySelectorAll('.expand-btn');
  expandButtons.forEach(button => {
    button.addEventListener('click', function() {
      const target = this.dataset.target;
      showExpandedCode(target);
    });
  });
}

function addSyntaxHighlighting() {
  // Simple syntax highlighting for C# and C++
  const codeBlocks = document.querySelectorAll('code');
  
  codeBlocks.forEach(block => {
    let content = block.innerHTML;
    
    // Highlight keywords
    const keywords = [
      'public', 'private', 'protected', 'class', 'interface', 'struct', 'enum',
      'void', 'int', 'float', 'string', 'bool', 'var', 'const', 'static',
      'override', 'virtual', 'abstract', 'sealed', 'readonly', 'namespace',
      'using', 'if', 'else', 'for', 'while', 'foreach', 'do', 'switch', 'case',
      'break', 'continue', 'return', 'try', 'catch', 'finally', 'throw',
      'new', 'this', 'base', 'null', 'true', 'false'
    ];
    
    keywords.forEach(keyword => {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      content = content.replace(regex, `<span class="keyword">${keyword}</span>`);
    });
    
    // Highlight comments
    content = content.replace(/\/\/.*$/gm, '<span class="comment">$&</span>');
    content = content.replace(/\/\*[\s\S]*?\*\//gm, '<span class="comment">$&</span>');
    
    // Highlight strings
    content = content.replace(/"([^"\\]|\\.)*"/g, '<span class="string">$&</span>');
    
    // Highlight numbers
    content = content.replace(/\b\d+\.?\d*f?\b/g, '<span class="number">$&</span>');
    
    // Highlight types
    const types = [
      'Vector3', 'Transform', 'GameObject', 'NetworkBehaviour', 'MonoBehaviour',
      'UBehaviorTreeComponent', 'UBTTaskNode', 'EBTNodeResult', 'APawn', 'AActor',
      'FVector', 'Queue', 'IPoolable'
    ];
    
    types.forEach(type => {
      const regex = new RegExp(`\\b${type}\\b`, 'g');
      content = content.replace(regex, `<span class="type">${type}</span>`);
    });
    
    block.innerHTML = content;
  });
}

function showExpandedCode(target) {
  // Create modal with expanded code
  const modal = document.createElement('div');
  modal.className = 'code-modal-overlay';
  modal.innerHTML = `
    <div class="code-modal">
      <div class="code-modal-header">
        <h3>Full Implementation</h3>
        <button class="close-modal">&times;</button>
      </div>
      <div class="code-modal-content">
        <pre><code class="language-csharp">${getExpandedCode(target)}</code></pre>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Add event listeners
  modal.querySelector('.close-modal').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
  
  // Close with Escape key
  document.addEventListener('keydown', function handleEscape(e) {
    if (e.key === 'Escape' && document.body.contains(modal)) {
      document.body.removeChild(modal);
      document.removeEventListener('keydown', handleEscape);
    }
  });
}

function getExpandedCode(target) {
  const codeLibrary = {
    'snippet-1': `// Complete Client-Server Networking Implementation
public class NetworkPlayerController : NetworkBehaviour
{
    [Header("Movement Settings")]
    public float moveSpeed = 5f;
    public float reconciliationThreshold = 0.1f;
    
    [Header("Networking")]
    private float lastServerUpdate;
    private Vector3 lastValidatedPosition;
    private Queue<MovementInput> inputBuffer = new Queue<MovementInput>();
    
    private struct MovementInput
    {
        public Vector3 direction;
        public float timestamp;
        public int inputSequence;
    }
    
    private void Update()
    {
        if (IsOwner)
        {
            HandleClientInput();
        }
    }
    
    private void HandleClientInput()
    {
        Vector3 input = new Vector3(
            Input.GetAxis("Horizontal"),
            0,
            Input.GetAxis("Vertical")
        );
        
        if (input.magnitude > 0.1f)
        {
            float timestamp = Time.time;
            int sequence = GetNextInputSequence();
            
            // Store input for potential reconciliation
            inputBuffer.Enqueue(new MovementInput 
            { 
                direction = input, 
                timestamp = timestamp, 
                inputSequence = sequence 
            });
            
            // Apply movement locally (client prediction)
            Vector3 movement = input.normalized * moveSpeed * Time.deltaTime;
            transform.position += movement;
            
            // Send to server for validation
            MovePlayerServerRpc(transform.position, timestamp, sequence);
        }
    }
    
    [ServerRpc]
    private void MovePlayerServerRpc(Vector3 position, float timestamp, int sequence)
    {
        // Validate movement on server
        float deltaTime = timestamp - lastServerUpdate;
        Vector3 expectedMovement = CalculateExpectedMovement(deltaTime);
        
        if (IsValidMovement(position, expectedMovement, timestamp))
        {
            transform.position = position;
            lastServerUpdate = timestamp;
            lastValidatedPosition = position;
            
            // Confirm to all clients
            UpdatePositionClientRpc(position, timestamp, sequence);
        }
        else
        {
            // Reject movement, force correction
            ForcePositionCorrectionClientRpc(lastValidatedPosition, timestamp);
        }
    }
    
    [ClientRpc]
    private void UpdatePositionClientRpc(Vector3 serverPosition, float timestamp, int sequence)
    {
        if (!IsOwner) 
        {
            // Non-owner clients: smooth interpolation
            StartCoroutine(InterpolateToPosition(serverPosition));
        }
        else
        {
            // Owner client: check for reconciliation need
            float distance = Vector3.Distance(transform.position, serverPosition);
            if (distance > reconciliationThreshold)
            {
                ReconcilePosition(serverPosition, sequence);
            }
        }
    }
    
    private void ReconcilePosition(Vector3 serverPosition, int acknowledgedSequence)
    {
        // Rollback to server position
        transform.position = serverPosition;
        
        // Replay inputs after acknowledged sequence
        Queue<MovementInput> replayInputs = new Queue<MovementInput>();
        while (inputBuffer.Count > 0)
        {
            MovementInput input = inputBuffer.Dequeue();
            if (input.inputSequence > acknowledgedSequence)
            {
                replayInputs.Enqueue(input);
            }
        }
        
        // Replay unacknowledged inputs
        while (replayInputs.Count > 0)
        {
            MovementInput input = replayInputs.Dequeue();
            Vector3 movement = input.direction.normalized * moveSpeed * Time.fixedDeltaTime;
            transform.position += movement;
            inputBuffer.Enqueue(input); // Keep for potential future reconciliation
        }
    }
    
    private bool IsValidMovement(Vector3 position, Vector3 expectedMovement, float timestamp)
    {
        // Implement server-side movement validation logic
        float maxDistance = moveSpeed * (timestamp - lastServerUpdate) * 1.1f; // 10% tolerance
        return Vector3.Distance(lastValidatedPosition, position) <= maxDistance;
    }
    
    private IEnumerator InterpolateToPosition(Vector3 targetPosition)
    {
        Vector3 startPosition = transform.position;
        float elapsed = 0f;
        float duration = 0.1f; // Smooth interpolation over 100ms
        
        while (elapsed < duration)
        {
            elapsed += Time.deltaTime;
            float t = elapsed / duration;
            transform.position = Vector3.Lerp(startPosition, targetPosition, t);
            yield return null;
        }
        
        transform.position = targetPosition;
    }
}`,

    'snippet-2': `// Complete AI Behavior Tree System Implementation
UCLASS()
class SLAYLIEN_API BTTask_SwitchTarget : public UBTTaskNode
{
    GENERATED_BODY()

public:
    BTTask_SwitchTarget(FObjectInitializer const& ObjectInitializer);
    virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;
    
protected:
    // Configurable properties
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Target Selection")
    float DetectionRadius = 1500.0f;
    
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Target Selection")
    float ThreatWeightDistance = 0.4f;
    
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Target Selection")
    float ThreatWeightHealth = 0.3f;
    
    UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Target Selection")
    float ThreatWeightDamage = 0.3f;
    
private:
    bool FindOptimalTarget(APawn* CurrentPawn, AActor*& OutTarget);
    float CalculateThreatLevel(AActor* Target, FVector EnemyLocation);
    TArray<AActor*> GetPotentialTargets(APawn* CurrentPawn);
    bool IsValidTarget(AActor* Target, APawn* CurrentPawn);
    float GetTargetHealth(AActor* Target);
    float GetTargetDamageOutput(AActor* Target);
};

BTTask_SwitchTarget::BTTask_SwitchTarget(FObjectInitializer const& ObjectInitializer)
{
    NodeName = TEXT("Switch Target");
    bNotifyTick = false;
    bNotifyTaskFinished = true;
}

EBTNodeResult::Type BTTask_SwitchTarget::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory)
{
    AAIController* AIController = OwnerComp.GetAIOwner();
    if (!AIController || !AIController->GetPawn())
    {
        return EBTNodeResult::Failed;
    }
    
    APawn* CurrentPawn = AIController->GetPawn();
    AActor* CurrentTarget = Cast<AActor>(OwnerComp.GetBlackboardComponent()->GetValueAsObject(GetSelectedBlackboardKey()));
    
    AActor* NewTarget = nullptr;
    if (FindOptimalTarget(CurrentPawn, NewTarget))
    {
        // Only switch if new target is significantly better or current target is invalid
        if (!CurrentTarget || !IsValidTarget(CurrentTarget, CurrentPawn) || 
            (NewTarget != CurrentTarget && CalculateThreatLevel(NewTarget, CurrentPawn->GetActorLocation()) > 
             CalculateThreatLevel(CurrentTarget, CurrentPawn->GetActorLocation()) * 1.2f))
        {
            OwnerComp.GetBlackboardComponent()->SetValueAsObject(GetSelectedBlackboardKey(), NewTarget);
            
            // Optional: Broadcast target switch for audio/visual feedback
            if (ASlaylienEnemy* Enemy = Cast<ASlaylienEnemy>(CurrentPawn))
            {
                Enemy->OnTargetSwitched(NewTarget);
            }
            
            return EBTNodeResult::Succeeded;
        }
    }
    
    return EBTNodeResult::Failed;
}

bool BTTask_SwitchTarget::FindOptimalTarget(APawn* CurrentPawn, AActor*& OutTarget)
{
    TArray<AActor*> PotentialTargets = GetPotentialTargets(CurrentPawn);
    
    if (PotentialTargets.Num() == 0)
    {
        OutTarget = nullptr;
        return false;
    }
    
    AActor* BestTarget = nullptr;
    float HighestThreatLevel = -1.0f;
    FVector EnemyLocation = CurrentPawn->GetActorLocation();
    
    for (AActor* Target : PotentialTargets)
    {
        if (IsValidTarget(Target, CurrentPawn))
        {
            float ThreatLevel = CalculateThreatLevel(Target, EnemyLocation);
            
            if (ThreatLevel > HighestThreatLevel)
            {
                HighestThreatLevel = ThreatLevel;
                BestTarget = Target;
            }
        }
    }
    
    OutTarget = BestTarget;
    return BestTarget != nullptr;
}

float BTTask_SwitchTarget::CalculateThreatLevel(AActor* Target, FVector EnemyLocation)
{
    if (!Target)
        return 0.0f;
    
    // Distance factor (closer = higher threat)
    float Distance = FVector::Dist(Target->GetActorLocation(), EnemyLocation);
    float NormalizedDistance = FMath::Clamp(Distance / DetectionRadius, 0.0f, 1.0f);
    float DistanceFactor = (1.0f - NormalizedDistance) * ThreatWeightDistance;
    
    // Health factor (lower health = easier target)
    float TargetHealth = GetTargetHealth(Target);
    float HealthFactor = (1.0f - FMath::Clamp(TargetHealth / 100.0f, 0.0f, 1.0f)) * ThreatWeightHealth;
    
    // Damage factor (higher damage output = higher priority)
    float TargetDamage = GetTargetDamageOutput(Target);
    float DamageFactor = FMath::Clamp(TargetDamage / 50.0f, 0.0f, 1.0f) * ThreatWeightDamage;
    
    return DistanceFactor + HealthFactor + DamageFactor;
}

TArray<AActor*> BTTask_SwitchTarget::GetPotentialTargets(APawn* CurrentPawn)
{
    TArray<AActor*> FoundTargets;
    UWorld* World = CurrentPawn->GetWorld();
    
    if (!World)
        return FoundTargets;
    
    // Use sphere overlap to find potential targets
    TArray<FOverlapResult> OverlapResults;
    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(CurrentPawn);
    
    bool bHit = World->OverlapMultiByChannel(
        OverlapResults,
        CurrentPawn->GetActorLocation(),
        FQuat::Identity,
        ECollisionChannel::ECC_Pawn,
        FCollisionShape::MakeSphere(DetectionRadius),
        QueryParams
    );
    
    if (bHit)
    {
        for (const FOverlapResult& Result : OverlapResults)
        {
            if (AActor* Actor = Result.GetActor())
            {
                // Filter for player characters or relevant target types
                if (Actor->IsA<APlayerCharacter>())
                {
                    FoundTargets.Add(Actor);
                }
            }
        }
    }
    
    return FoundTargets;
}`,

    'snippet-3': `// Complete High-Performance Object Pool System
using System;
using System.Collections.Generic;
using UnityEngine;

public interface IPoolable
{
    void OnPoolGet();
    void OnPoolReturn();
    bool IsInUse { get; }
}

[System.Serializable]
public class ObjectPool<T> where T : MonoBehaviour, IPoolable
{
    [Header("Pool Configuration")]
    [SerializeField] private T prefab;
    [SerializeField] private int initialSize = 10;
    [SerializeField] private int maxSize = 100;
    [SerializeField] private bool allowGrowth = true;
    
    private readonly Queue<T> availableObjects = new Queue<T>();
    private readonly HashSet<T> allObjects = new HashSet<T>();
    private readonly Transform parentTransform;
    
    // Performance tracking
    private int totalCreated = 0;
    private int totalReused = 0;
    
    public ObjectPool(T prefab, Transform parent = null, int initialSize = 10, int maxSize = 100)
    {
        this.prefab = prefab;
        this.parentTransform = parent;
        this.initialSize = initialSize;
        this.maxSize = maxSize;
        
        InitializePool();
    }
    
    private void InitializePool()
    {
        // Pre-populate pool with initial objects
        for (int i = 0; i < initialSize; i++)
        {
            CreateNewObject();
        }
    }
    
    public T Get()
    {
        T obj = null;
        
        // Try to get from available pool
        while (availableObjects.Count > 0)
        {
            obj = availableObjects.Dequeue();
            
            // Ensure object is still valid (not destroyed)
            if (obj != null && !obj.IsInUse)
            {
                ActivateObject(obj);
                totalReused++;
                return obj;
            }
            else if (obj != null)
            {
                // Remove invalid objects from tracking
                allObjects.Remove(obj);
            }
        }
        
        // No available objects, create new one if allowed
        if (allowGrowth && allObjects.Count < maxSize)
        {
            obj = CreateNewObject();
            ActivateObject(obj);
            return obj;
        }
        
        // Pool exhausted and can't grow
        Debug.LogWarning($"Object pool exhausted for {typeof(T).Name}. Consider increasing max size or optimizing usage.");
        return null;
    }
    
    public void Return(T obj)
    {
        if (obj == null || !allObjects.Contains(obj))
        {
            Debug.LogWarning("Attempting to return object that doesn't belong to this pool or is null.");
            return;
        }
        
        if (!obj.IsInUse)
        {
            Debug.LogWarning("Attempting to return object that is already in pool.");
            return;
        }
        
        DeactivateObject(obj);
        availableObjects.Enqueue(obj);
    }
    
    public void ReturnAll()
    {
        foreach (T obj in allObjects)
        {
            if (obj != null && obj.IsInUse)
            {
                DeactivateObject(obj);
                availableObjects.Enqueue(obj);
            }
        }
    }
    
    private T CreateNewObject()
    {
        if (prefab == null)
        {
            Debug.LogError("Cannot create object: prefab is null");
            return null;
        }
        
        T newObj = UnityEngine.Object.Instantiate(prefab, parentTransform);
        allObjects.Add(newObj);
        totalCreated++;
        
        // Initialize in deactivated state
        newObj.gameObject.SetActive(false);
        
        return newObj;
    }
    
    private void ActivateObject(T obj)
    {
        obj.gameObject.SetActive(true);
        obj.OnPoolGet();
    }
    
    private void DeactivateObject(T obj)
    {
        obj.OnPoolReturn();
        obj.gameObject.SetActive(false);
    }
    
    // Pool management and statistics
    public void ClearPool()
    {
        foreach (T obj in allObjects)
        {
            if (obj != null)
            {
                UnityEngine.Object.Destroy(obj.gameObject);
            }
        }
        
        allObjects.Clear();
        availableObjects.Clear();
    }
    
    public PoolStatistics GetStatistics()
    {
        return new PoolStatistics
        {
            TotalCreated = totalCreated,
            TotalReused = totalReused,
            CurrentPoolSize = allObjects.Count,
            AvailableObjects = availableObjects.Count,
            ActiveObjects = allObjects.Count - availableObjects.Count,
            ReuseRatio = totalReused / (float)Math.Max(1, totalCreated + totalReused)
        };
    }
}

[System.Serializable]
public struct PoolStatistics
{
    public int TotalCreated;
    public int TotalReused;
    public int CurrentPoolSize;
    public int AvailableObjects;
    public int ActiveObjects;
    public float ReuseRatio;
}

// Example implementation for a bullet object
public class Bullet : MonoBehaviour, IPoolable
{
    [Header("Bullet Settings")]
    public float speed = 10f;
    public float lifetime = 5f;
    
    private Rigidbody rb;
    private float spawnTime;
    
    public bool IsInUse { get; private set; }
    
    private void Awake()
    {
        rb = GetComponent<Rigidbody>();
    }
    
    public void OnPoolGet()
    {
        IsInUse = true;
        spawnTime = Time.time;
        
        // Reset bullet state
        rb.velocity = Vector3.zero;
        rb.angularVelocity = Vector3.zero;
        
        // Start movement
        rb.velocity = transform.forward * speed;
        
        // Auto-return to pool after lifetime
        Invoke(nameof(ReturnToPool), lifetime);
    }
    
    public void OnPoolReturn()
    {
        IsInUse = false;
        
        // Cancel any pending auto-return
        CancelInvoke(nameof(ReturnToPool));
        
        // Reset physics
        rb.velocity = Vector3.zero;
        rb.angularVelocity = Vector3.zero;
    }
    
    private void OnTriggerEnter(Collider other)
    {
        // Handle collision and return to pool
        if (other.CompareTag("Enemy"))
        {
            // Deal damage, create effects, etc.
            ReturnToPool();
        }
    }
    
    private void ReturnToPool()
    {
        // Return this bullet to the pool
        BulletManager.Instance.ReturnBullet(this);
    }
}`
  };
  
  return codeLibrary[target] || 'Code not found.';
}