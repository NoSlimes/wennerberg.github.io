// DevCon - expanded examples: converters, registration and chained commands
using System;

public static class DevConFullExamples
{
    // Example command with response callback and nullable/default argument
    [ConsoleCommand("screenshot", "Take a screenshot (optional filename)")]
    public static void ScreenshotCommand(Action<string, bool> response, string filename = "screenshot.png")
    {
        // ScreenCapture.CaptureScreenshot(filename);
        response?.Invoke($"Saved screenshot as {filename}", true);
    }

    // Example registering a custom argument converter (Vector3)
    public static void RegisterConverters()
    {
        ConsoleCommandInvoker.RegisterArgConverter<UnityEngine.Vector3>(arg =>
        {
            var parts = arg.Trim('(', ')').Split(',');
            if (parts.Length != 3) throw new ArgumentException($"Could not convert '{arg}' to Vector3");
            return new UnityEngine.Vector3(
                float.Parse(parts[0]),
                float.Parse(parts[1]),
                float.Parse(parts[2])
            );
        });
    }

    // Example command demonstrating enum and Vector3 args
    [ConsoleCommand("teleport", "Teleport entity to position.")]
    public static void TeleportCommand(Action<string> response, string entityName, UnityEngine.Vector3 position)
    {
        // Find entity and set position
        response?.Invoke($"Teleporting {entityName} to {position}", true);
    }

    // Chained commands example (entered into console):
    // teleport Player (0,1,0) | screenshot "after-teleport.png"
}
