---
pageTitle: Project - SLAYLIEN
heroImage: /assets/projects/slaylien/slaylien.png
heroVideoUrl: "https://youtu.be/BY15e9aDYMk?t=3"
projectName: SLAYLIEN
projectType: "[GAME PROJECT 3 - FUTUREGAMES]"
flairs:
  - Unreal Engine 5
  - Blueprints
  - C++
  - Group Project
projectInfo:
  Team Size: 11
  Engine: Unreal Engine 5
  Language: C++ & Blueprints
  Duration: "7 weeks"
  Key Features: Wave Defense, Character Switching
highlights:
  - Implemented character switching with AI handoff in Unreal C++
  - Built data-driven wave configs for rapid showcase tuning
  - Designed multi-point generator damage to fix enemy targeting
galleryImages:
  - https://img.itch.zone/aW1hZ2UvMzc4NzU5My8yMjU4Mzk2MS5wbmc=/original/3EpW29.png
  - https://img.itch.zone/aW1hZ2UvMzc4NzU5My8yMjU4Mzk1OS5wbmc=/original/UQBgmH.png
  - https://img.itch.zone/aW1hZ2UvMzc4NzU5My8yMjU4Mzk1Ny5wbmc=/original/h7Q0By.png
videoURL: "https://youtu.be/BY15e9aDYMk?t=3"
---

Slaylien is a third-person wave-defense game where players control a team of three characters to fend off hordes of insectoid aliens. Developed in Unreal Engine 5, it features a unique character switching mechanic where players can switch between characters in real-time to utilize their unique abilities.

## My Role

- Built the character switching system in C++ using Unreal possession and AI handoff.
- Implemented the data-driven wave spawning pipeline for rapid iteration during showcases.
- Created the generator multi-point damage system to improve enemy targeting on large structures.


## Character Switching

### The Character Switching Mechanic

The core design pillar was creating a dynamic combat experience. Instead of being locked into one playstyle, players can instantly swap between a tank, a damage-dealer, and a ranged character. This was implemented in C++, using the possession system of the character/controllers in Unreal—when one character is unpossessed, the next gets posessed.

I built the controller flow that cycles through alive units, cleanly hands off possession, and keeps camera ownership consistent so swaps feel immediate and readable in combat.

```cpp
void APlayerUnitController::SwitchUnit(int Direction)
{
  if (UnitList.Num() == 0)
    return;

  int32 CurrentIndex = UnitList.IndexOfByKey(ControlledUnit);
  if (CurrentIndex == INDEX_NONE)
  {
    CurrentIndex = 0;
  }

  int32 NumUnits = UnitList.Num();
  int32 Attempts = 0;
  int32 NextIndex = CurrentIndex;

  Direction = (Direction >= 0) ? 1 : -1;

  do
  {
    NextIndex = (NextIndex + Direction + NumUnits) % NumUnits;
    APlayerControllableUnit* NextUnit = UnitList[NextIndex];

    if (IDamageable::Execute_IsAlive(NextUnit))
    {
      SetViewTarget(NextUnit);
      UnPossess();
      Possess(NextUnit);
      ControlledUnit = NextUnit;
      return;
    }

    Attempts++;
  } while (Attempts < NumUnits);
}

void APlayerUnitController::OnPossessDefender(APawn* InPawn)
{
  ControlledUnit = Cast<APlayerControllableUnit>(InPawn);
  if (!IsValid(ControlledUnit))
    return;

  AController* PreviousController = ControlledUnit->GetController();
  if (IsValid(PreviousController) && PreviousController != this)
  {
    PreviousController->UnPossess();
    UnitControllers.Add(ControlledUnit, PreviousController);
  }

  CameraSpringArm = ControlledUnit->FindComponentByClass<USpringArmComponent>();
  FRotator CameraRotation = CameraSpringArm->GetRelativeRotation();
  CameraRotation.Pitch = CameraPitch;
  CameraSpringArm->SetRelativeRotation(CameraRotation);

  OnUnitSwitched.Broadcast(ControlledUnit);
}
```

## AI And Waves

### AI Development

The alien AI was developed using Unreal's Behavior Trees and Blackboards. This allowed us to quickly prototype behaviours and easily adjust their parameters for balancing. When impleting the AI, I decided to aplit the characters, Units, in the game into two categories; Units that are controllable by the player, and Units that are solely controlled by the AI. This allowed us to create a more complex AI system, where the AI could control the alien units, while the player could control their own characters. When the player switches from a character, an AI controller kicks in, and takes control over the character, continuing to fight the aliens.

### Wave Defense Mechanics

The game features a wave-based system where players must survive increasingly difficult waves of enemies. The wave spawning system was designed to be data-driven, allowing designers to easily adjust enemy types, spawn rates, and wave difficulty without needing to modify code. During showcases we could tweak wave configs live for quick pacing changes. When the game starts the wave manager reads the wave configuration file and spanws the wave based on it.

During the live showcase, we hot-modified the JSON to adjust waves on the fly without a rebuild.

### Wave Config Example

Single wave entry from the JSON config, showing how enemies and timings are defined.

```json
{
  "Name": "Wave_1",
  "Subwaves": [
    {
      "Enemies": [
        { "EnemyType": "Swarmer", "EnemyCount": 14 },
        { "EnemyType": "Bomber", "EnemyCount": 3 }
      ],
      "SpawnPointIndex": 0,
      "MaxTimeBeforeStart": 5,
      "OpenAssignedDoor": true
    }
  ],
  "UpgradePointsAwarded": 1
}
```

### Wave Manager Snippet

The wave manager loads the JSON file on startup and builds the runtime wave list.

```cpp
void AWaveManager::LoadWaveData()
{
  WaveDataArray.Empty();

  FString DataPath = FPaths::ProjectContentDir() + TEXT("Data/WaveData.json");
  FString JsonString;

  if (!FFileHelper::LoadFileToString(JsonString, *DataPath))
  {
    LOG_ERROR("Failed to load WaveData.json file at: %s", *DataPath);
    return;
  }

  TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(JsonString);
  TArray<TSharedPtr<FJsonValue>> JsonArray;

  if (!FJsonSerializer::Deserialize(Reader, JsonArray))
  {
    LOG_ERROR("Failed to parse JSON array from WaveData.json: %s", *DataPath);
    return;
  }

  for (const TSharedPtr<FJsonValue>& Value : JsonArray)
  {
    TSharedPtr<FJsonObject> WaveObject = Value->AsObject();
    if (!WaveObject.IsValid())
    {
      LOG_WARNING("Encountered invalid object in WaveData JSON array.");
      continue;
    }
    FWaveData Wave;
    Wave.FromJson(WaveObject);
    WaveDataArray.Add(Wave);
  }
}
```

## Damage Systems

### Generator Damage System

Built a multi-point damage system for a large generator so enemies target the nearest weak point instead of clustering on an oversized center. Damage from any weak point forwards to a shared core health and triggers a unified death event.

```cpp
void AGeneratorStructure::BeginPlay()
{
  Instance = this;
  Super::BeginPlay();

  TArray<UChildActorComponent*> ChildComponents;
  GetComponents<UChildActorComponent>(ChildComponents);

  for (UChildActorComponent* ChildComponent : ChildComponents)
  {
    if (ChildComponent && ChildComponent->GetChildActor())
    {
      ADamageableDummy* DamageablePoint = Cast<ADamageableDummy>(ChildComponent->GetChildActor());
      if (DamageablePoint)
      {
        DamageablePoints.Add(DamageablePoint);
        DamageablePoint->SetOwner(this);
        DamageablePoint->OnDamageReceived.BindUObject(this, &AGeneratorStructure::OnDummyDamageReceived);
      }
    }
  }
}

ADamageableDummy* AGeneratorStructure::GetClosestDamageablePoint(const FVector& Location) const
{
  float ClosestDistance = TNumericLimits<float>::Max();
  TObjectPtr<ADamageableDummy> ClosestPoint = nullptr;

  for (const TObjectPtr<ADamageableDummy>& Point : DamageablePoints)
  {
    if (!Point || !Point->IsValidLowLevel())
    {
      continue;
    }
    float Distance = FVector::DistSquared(Location, Point->GetActorLocation());
    if (Distance < ClosestDistance)
    {
      ClosestDistance = Distance;
      ClosestPoint = Point;
    }
  }

  return ClosestPoint;
}
```

### Damageable Interface

Defined a Blueprint-native IDamageable interface to standardize damage, healing, and health queries across actors for clean C++/Blueprint interoperability.
