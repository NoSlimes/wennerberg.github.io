---
pageTitle: Project - SLAYLIEN
heroImage: https://picsum.photos/id/30/1200/400
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
  Key Features: Wave Defense, Character Switching
galleryImages:
  - https://picsum.photos/id/41/400/600
  - https://picsum.photos/id/42/600/400
  - https://picsum.photos/id/43/500/500
videoURL: ""
---

Slaylien is a third-person wave-defense game where players control a team of three characters to fend off hordes of insectoid aliens. Developed in Unreal Engine 5, it features a unique character switching mechanic where players can switch between characters in real-time to utilize their unique abilities.


## The Character Switching Mechanic

The core design pillar was creating a dynamic combat experience. Instead of being locked into one playstyle, players can instantly swap between a tank, a damage-dealer, and a ranged character. This was implemented in C++, leveraging the possession system of the character/controllers in Unreal—when one character is unpossessed, the next gets posessed.

## AI Development

The alien AI was developed using Unreal's Behavior Trees and Blackboards. This allowed us to quickly prototype behaviours and easily adjust their parameters for balancing. When impleting the AI, I decided to aplit the characters, Units, in the game into two categories; Units that are controllable by the player, and Units that are solely controlled by the AI. This allowed us to create a more complex AI system, where the AI could control the alien units, while the player could control their own characters. When the player switches from a character, an AI controller kicks in, and takes control over the character, continuing to fight the aliens.

## Wave Defense Mechanics

The game features a wave-based system where players must survive increasingly difficult waves of enemies. The wave spawning system was designed to be data-driven, allowing designers to easily adjust enemy types, spawn rates, and wave difficulty without needing to modify code. When the game starts the wave manager reads the wave configuration file and spanws the wave based on it.
