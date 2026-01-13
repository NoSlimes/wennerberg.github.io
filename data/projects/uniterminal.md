---
pageTitle: Project - UniTerminal
heroImage: /assets/projects/UniTerminal/uniterminal-hero.png
projectName: UniTerminal
projectType: "[IN-GAME DEVELOPER CONSOLE - UNITY]"
flairs:
  - Unity
  - C#
  - Tooling
projectInfo:
  Language: C#
  Engine: Unity
codeLanguage: csharp
codePreviewFile: "/assets/code/UniTerminal-preview.cs"
codeExpandedFile: "/assets/code/UniTerminal-full.cs"
galleryImages: []
videoURL: ""
highlights:
  - Built a safe runtime command registration and execution system for both editor and runtime builds.
  - Implemented an overlay UI with command history, auto-complete, and argument parsing.
  - Designed flexible command flags, chaining, and dynamic argument suggestions.
  - Documented usage patterns for easy integration in existing Unity projects.
---

UniTerminal is an in-game developer console built for Unity. It provides a runtime overlay where developers can type and execute registered custom commands. The focus is on a simple, extensible command registration API and a lightweight console UI.

## What UniTerminal Does

UniTerminal provides a lightweight console overlay for entering and executing custom runtime commands. Commands are registered via a small API and executed immediately. The console supports command history and tab-based auto-completion for both command names and arguments.

{{image:https://picsum.photos/id/62/600/400|UniTerminal console overlay|center}}

## Command System

Commands are methods decorated with `[ConsoleCommand]`.

The first parameter can optionally be a response callback:

- `Action<string>` — receives console messages.
- `Action<string, bool>` — receives message + success/failure.
- `CommandResponseDelegate` — receives message + optional success/failure.

Remaining parameters are parsed automatically, supporting:

- `string`, `int`, `float`, `bool`
- `enum`, `Vector2`, `Vector3`
- `Color`, `Quaternion`, nullable types

Multiple commands can be chained using the `|` separator, executing sequentially without stopping on errors.

## Flags & Permissions

Commands can include flags to control availability:

- `DebugOnly` — only in debug builds
- `EditorOnly` — only in the Unity editor
- `Cheat` — requires `CheatsEnabled`
- `Mod` — added by external mods/plugins
- `Hidden` — hidden from help, still executable

## Auto-completion & Suggestions

Tab-based auto-completion works for command names and arguments. Built-in types (`bool`, `enum`) are automatically suggested.

Custom argument suggestions can be provided via static methods using the `AutoCompleteProvider` property. Supported signatures:

- `()` — same suggestions for every argument
- `(int index)` — system filters per argument index
- `(string prefix)` — custom filtering by input
- `(string prefix, int index)` — full control per argument

## Performance & Runtime

UniTerminal precomputes and caches command metadata in the editor for zero startup reflection cost at runtime.

Runtime assemblies, such as mods or DLCs, can be scanned manually with `UniTerminal.DiscoverCommandsInAssembly()` to register commands dynamically.
