---
pageTitle: Project - UniTerminal
heroImage: /assets/projects/uniterminal/hero.png
projectName: UniTerminal
projectType: "IN-GAME COMMAND CONSOLE | SOLO PROJECT | [MIT](https://github.com/NoSlimes/UniTerminal/tree/main)"
flairs:
  - Unity
  - C#
  - Tooling
  - Reflection
projectInfo:
    Language: C#
    Engine: Unity
    License: MIT
    Dependencies: Unity
galleryImages: []
videoURL: ""
highlights:
  - Optimizes developer velocity by providing a project-agnostic debug bridge.
  - Implements a metadata baking system for zero-cost runtime command discovery.
  - Supports complex argument parsing (Vectors, Enums, Quaternions) out of the box.
  - Features a declarative API with bitwise flags for granular permission control.
---

UniTerminal is a high-performance in-game developer console designed to eliminate slow iteration loops. It serves as a project-agnostic bridge to game logic, enabling real-time state manipulation and testing without the need for constant recompilation or custom debug UIs.

## Async Metadata Baking

To ensure UniTerminal has a near-zero impact on runtime performance, I implemented a `Metadata Baking` system. Traditional reflection-based consoles scan all assemblies at startup, causing noticeable CPU spikes and "hitchy" loading screens.

Instead, UniTerminal hooks into the Unity compilation pipeline and pre-scans methods in the Editor, serializing the metadata into a ScriptableObject. To keep the Editor responsive, I implemented an `Async Discovery` system using `Task.Run` and Unity's `Progress` API to display progrees. This offloads the scan to a background thread so the cache builds without locking the UI.

This shifts the `O(N)` cost of assembly scanning to edit-time, allowing the runtime to initialize in constant time. The performance difference is massive: in this example loading from the baked cache takes `~1.8ms`, compared to `~9.6 seconds` for a full runtime scan. That is about a `5200x` increase in startup performance!

```csharp
// Offloads the expensive Reflection scan to a background thread to keep the Editor responsive
internal static async void DiscoverCommandsEditor()
{
    int taskId = Progress.Start("UniTerminal", "Building Command Cache...");
    try
    {
        await DiscoverCommandsAsync(AppDomain.CurrentDomain.GetAssemblies(), true, 
            (progress, message) => Progress.Report(taskId, progress, message));
    }
    finally { Progress.Finish(taskId); }
}

// Reconstructs the command dictionary from the cached metadata at runtime
public static void LoadCache()
{
    _cache = Resources.Load<ConsoleCommandCache>("UniTerminal/UniTerminalCommandCache");
    
    foreach (var entry in _cache.Commands)
    {
        Type type = Type.GetType(entry.DeclaringTypeName);
        var paramTypes = entry.ParameterTypes.Select(Type.GetType).ToArray();
        var method = type.GetMethod(entry.MethodName, flags, null, paramTypes, null);
        
        // Map method info and cache for execution...
    }
}
```
Here's the load time using the cache and no runtime discovery:
![Fast runtime loading](/assets/projects/uniterminal/supafast.png)

Aaaand, here's without
![Slow runtime loading w/ discovery](/assets/projects/uniterminal/supaslow.png)

## Flexible API & Command Configuration

The system is built around a declarative, attribute-driven API. Developers can configure command behavior, permissions, and discovery directly at the method site using bitwise flags and dynamic providers.

### Permission Control via Bitwise Flags
The system utilizes a `CommandFlags` enum to manage command availability across different contexts. This allows for granular control, such as marking specific commands as "Cheat" only or stripping debug tools from release builds.

```csharp
// Example: A cheat command restricted to debug builds and hidden from the help menu
[ConsoleCommand("ghost_mode", "Enables noclip and invisibility.", 
    Flags = CommandFlags.Cheat | CommandFlags.DebugOnly | CommandFlags.Hidden)]
public static void ToggleGhostMode(bool enabled) 
{
    Player.Instance.SetGhostMode(enabled);
}
```

### Intelligent Type Parsing & Suggestions
UniTerminal includes a custom parser for primitives and Unity-specific types, alongside a dynamic autocomplete system that allows for custom data providers.

```csharp
[ConsoleCommand("test_attack", "Tests an attack from the local player to a target player on a specified tile.", AutoCompleteProvider = nameof(TestAttackAutoComplete))]
public void TestAttackCommand(CommandResponseDelegate response, string weaponName, int sourceTileId, string targetPlayerName, int targetTileId)
{
    if (ItemDatabase.Instance.GetItemByName(weaponName) is not WeaponItemData weaponItem)
    {
        response($"Weapon '{weaponName}' not found.", false);
        return;
    }

    ulong nameToId = PlayerManager.Instance.GetAllPlayerInfo()
        .First(p => p.Username.ToString().Equals(targetPlayerName, StringComparison.OrdinalIgnoreCase)).ClientId;

    InitiateAttackOnTileServerRpc(weaponItem.ItemID, sourceTileId, nameToId, targetTileId);
}

// Dynamic provider used by the UI to suggest valid arguments to the user
private static IEnumerable<string> TestAttackAutoComplete(int argIndex)
{
    return argIndex switch
    {
        0 => ItemDatabase.Instance.AllData.Where(i => i is WeaponItemData).Select(i => i.InternalItemName),
        2 => PlayerManager.Instance.GetAllPlayerInfo().Select(p => p.Username.ToString()),
        _ => Enumerable.Empty<string>(),
    };
}
```

![UniTerminal autocomplete showcase](/assets/projects/uniterminal/auto_complete.webp)

### Help and Overloads

As every other command console in existence—UniTerminal has a help command. The help command lists all commands and their different overloads. Because the system tracks method signatures during the baking process, you can have multiple versions of the same command and the console will show you all of them.

```csharp
[ConsoleCommand("error", "Prints an error")]
private static void ErrorCommand(CommandResponseDelegate r)
{
    r("This is a command error.", false);
}

[ConsoleCommand("error", "Prints an error with a message")]
private static void ErrorCommand(CommandResponseDelegate r, string message)
{
    r(message, false);
}
```

### Intelligent Hover Hints
While you're typing, the console looks at where your cursor is and tells you exactly which parameter you’re currently filling out. It’s smart enough to check if the command signature uses any of the internal `command response delegates` or not, shifting the index so it always highlights the correct argument name in the UI. 

If you have multiple overloads for a single command, it will even aggregate the parameter names for that slot (e.g., `message | duration`), so you always know what your options are without having to run the help command first.

### Zero-Maintenance Documentation
The best part is that the developer don't have to manually write or update documentation. Since the system "bakes" everything directly from the source code, the help command is always 100% accurate. If the developer changes a parameter name or add a default value in the C# code, the console reflects that change immediately after the next compilation—no manual updates required. The obvious exception for this is the command description.

![Help command showcase](/assets/projects/uniterminal/help_overloads.webp)

## Error Handling
Everyone runs into some issues once in a while while coding. It's unavoidable. To prevent said issues crashing the whole program - UniTerminal wraps all command execution in try/catch blocks. In debug builds It outputs the full stack trace so the developer can track down what actually went wrong. They are displayed visually distinct in the console window. 

![UniTerminal errors](/assets/projects/uniterminal/errors.webp)

## Workflow Features
*   **Hot-Reload Support:** Automatically rebuilds the command cache on assembly reload, ensuring the console is always in sync with the latest code changes.
*   **Argument Parsing:** Robust support for `Nullable` types, `Enums`, and standard Unity math types.


## Real-World Impact

UniTerminal has become the backbone of development iteration on **PlanetFactory**, enabling rapid prototyping and debugging of complex systems:

- **Real-time Parameter Tuning:** Adjust networking configurations and hex-grid mechanics on the fly without scene reloads, dramatically reducing iteration cycles.
- **Network State Injection:** Instantly simulate edge cases and force specific game states to validate networking logic under controlled conditions.
- **Early Testing:** Bypass UI scaffolding entirely, allowing deep-system testing and balance tuning before front-end implementation begins.

![PlanetFactory nuke command for stress test](/assets/projects/uniterminal/nuke_command.webp)

### Collaborative Development

During the process of developing the system, I've received continuous feedback and suggestions from a friend. He's been actively using the tool while developing his own game [Bengan Box](https://store.steampowered.com/app/2269150/Bengan_Box/) and been able to give suggestions on several parts of the system. The autocomplete wouldn't have been as advanced as it is without his feedback - neither would it be as optimized as it now is with the reflection.