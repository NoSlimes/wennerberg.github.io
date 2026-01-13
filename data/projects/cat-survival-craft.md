---
pageTitle: Project - Cat Survival Craft
heroImage: /assets/projects/cat-survival-craft/cat-survival.png
projectName: CAT SURVIVAL CRAFT [WORKING TITLE]
projectType: "[PERSONAL PROJECT - NETWORKED GAMEPLAY]"
flairs:
  - Unity
  - C#
  - Networking (NGO)
projectInfo:
  Status: In Development
  Engine: Unity
  Language: C#
galleryImages:
  - /assets/projects/cat-survival-craft/cat-survival.png
  - /assets/projects/cat-survival-craft/cat-survival-00.gif
  - /assets/projects/cat-survival-craft/cat-survival-inventory-00.png
  - /assets/projects/cat-survival-craft/cat-survival-inventory-01.png
videoURL: "/assets/projects/cat-survival-craft/cat-survival.mp4"
codeLanguage: csharp
codePreviewFile: "/assets/code/Inventory-preview.cs"
codeExpandedFile: "/assets/code/Inventory-full.cs"
highlights:
  - Implemented a secure, server-side inventory system to prevent cheating and item duplication.
  - Implemented a basic server-authoritative movement system with client-side prediction.
---

An in-progress networked game project with server-authoritative gameplay. So far it features a fully server-authoritative inventory system.


## Networking Philosophy

The primary goal in this project is to build a secure, server-authoritative architecture. This means the server has the final say on all game state, preventing common cheats like flying or item duplication.

All player inputs are sent to the server, which processes them and broadcasts the resulting state back to the clients. All item useage (for tools like pickaxes, axes, etc.) is ran solely on the server, and the clients only receive the results of the actions. The game is made using NGO (Netcode for GameObjects).

{{gallery:cat-survival-inventory-00.png,cat-survival-inventory-01.png|Inventory System Screenshots}}

## Networked Inventory System

The inventory system is built with server authority as the top priority. Every item operation—adding, removing, swapping, or transferring—is validated server-side to prevent cheating and duplication exploits.

The system elegantly handles both stackable items (like resources) and unique instanced items (like tools with durability), with configurable access rules enabling different gameplay scenarios like private player inventories or proximity-based chests.

Built on Unity Netcode's RPC system, clients send action requests while the server maintains authority over all changes, ensuring fair gameplay with responsive UI updates.

