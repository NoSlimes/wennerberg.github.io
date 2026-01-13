---
pageTitle: Project - UniTerminal
heroImage: /assets/projects/UniTerminal/hero.png
projectName: UniTerminal
projectType: "[SYSTEMS & TOOLS - UNITY]"
instructorFeedback: "This project is overengineered compared to the expectations—thousands of lines of cohesively written, robust systems."
flairs:
  - Unity
  - C#
  - Tooling
  - Reflection
projectInfo:
  Language: C#
  Engine: Unity
codeLanguage: csharp
codePreviewFile: "/assets/code/UniTerminal-preview.cs"
codeExpandedFile: "/assets/code/UniTerminal-full.cs"
galleryImages: []
videoURL: ""
highlights:
  - Optimizes developer velocity by providing a project-agnostic debug bridge.
  - Implements a metadata baking system for zero-cost runtime command discovery.
  - Supports complex argument parsing (Vectors, Enums, Quaternions) out of the box.
  - Features a declarative API with bitwise flags for granular permission control.
---

UniTerminal is a high-performance in-game developer console designed to eliminate slow iteration loops. It serves as a project-agnostic bridge to game logic, enabling real-time state manipulation and testing without the need for constant recompilation or custom debug UIs.

## High-Performance Architecture: Metadata Baking

To ensure UniTerminal has a near-zero impact on runtime performance, I implemented a Metadata Baking system. Traditional reflection-based consoles scan all assemblies at startup, causing noticeable CPU spikes and "hitchy" loading screens.

Instead, UniTerminal hooks into the Unity compilation pipeline via [InitializeOnLoad]. It pre-scans and validates methods in the Editor, serializing the metadata into a ScriptableObject. This shifts the *O(N)* cost of assembly scanning to edit-time, allowing the runtime to initialize in constant time by simply loading a lightweight asset.

The trade-off for this a few seconds extra recompile time inside Unity - hence I made the automatic cache refresh optional.

```csharp
// Saves method metadata into a ScriptableObject to avoid expensive runtime Reflection
private static void UpdateCacheEditor(List<MethodInfo> methods)
{
    _cache = Resources.Load<ConsoleCommandCache>("UniTerminal/UniTerminalCommandCache");

    _cache.Commands = methods.Select(m => {
        var attr = m.GetCustomAttribute<ConsoleCommandAttribute>();
        return new CommandEntry {
            CommandName = attr?.Command ?? m.Name,
            DeclaringType = m.DeclaringType?.AssemblyQualifiedName,
            MethodName = m.Name,
            ParameterTypes = m.GetParameters().Select(p => p.ParameterType.AssemblyQualifiedName).ToArray()
        };
    }).ToArray();

    EditorUtility.SetDirty(_cache);
    AssetDatabase.SaveAssets();
}

// Reconstructs the command dictionary from the cached metadata at runtime
public static void LoadCache()
{
    _cache = Resources.Load<ConsoleCommandCache>("UniTerminal/UniTerminalCommandCache");
    _commands.Clear();

    foreach (var entry in _cache.Commands)
    {
        Type type = Type.GetType(entry.DeclaringType);
        if (type == null) continue;

        var methods = type.GetMethods(BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Static | BindingFlags.Instance)
                          .Where(m => m.Name == entry.MethodName);

        string key = entry.CommandName.ToLower();
        _commands[key] = methods.ToList();
    }
}
```

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

## Error handling
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