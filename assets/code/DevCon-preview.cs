// DevCon - concise example showing how to register a console command
// Note: DevCon discovers/compiles and caches commands in-editor after compilation.
// New commands will appear in the console after rebuilding the project in the editor.
using System;

public static class DevConExample
{
    [ConsoleCommand("setFOV", "Sets main camera FOV.")]
    public static void SetFOVCommand(Action<string, bool> response, float fov)
    {
        // Example: set Camera.main.fieldOfView = fov;
        response?.Invoke($"FOV set to {fov}", true);
    }

    [ConsoleCommand("greet", "Prints a greeting.")]
    public static void GreetCommand(Action<string> response, string name = "Player")
    {
        response?.Invoke($"Hello, {name}", true);
    }
}

// Usage (in the in-game console):
// setFOV 75
// greet "Bosse"
