---
pageTitle: Project - Slime Murderer
heroImage: /assets/projects/slime-murderer/slime-murderer-oob.gif
projectName: SLIME MURDERER
projectType: "COURSE PROJECT FUTUREGAMES: C# UNITY COURSE"
flairs:
  - Unity
  - C#
projectInfo:
  Team Size: 1
  Engine: Unity
  Language: C#
  Duration: ""
  Key Features: Endless | Abilities | Upgrades
highlights:
  - Developed the entire game from scratch as a solo project in Unity.
  - Procedural enemy spawning and wave management
  - An extendable player ability and upgrade system
  - A custom status effect system
galleryImages:
  - /assets/projects/slime-murderer/slime-murderer-00.gif
  - /assets/projects/slime-murderer/slime-murderer-01.gif
videoURL: ""
---

During my first C# course at Futuregames, we were tasked with making a clone of the game "Vampire Survivors". The goal was to replicate the core gameplay loop of surviving endless waves of enemies with auto-attacking weapons and a robust power-up system.


## Replicating the Core Loop

The biggest challenge was capturing the 'feel' of Vampire Survivors. Since I had never played the game before, I had to rely on gameplay videos and community feedback to understand its mechanics and pacing. I had to come up with my own interpretations of how certain systems worked, such as enemy spawn patterns and weapon behaviors. I opted to focus on active abilities rather than many passive ones to create a more engaging gameplay experience.

## Custom Status Effects

I implemented a custom status effect system that supports various effects like burning and poison. This system uses inheritance, allowing a specific status effect class to be selected in the inspector for abilities, where its settings can also be adjusted.

## Performance Optimization

With hundreds of enemies and projectiles on screen, performance was crucial. I implemented a comprehensive object pooling system to avoid constant instantiation and destruction of GameObjects. This system uses a centralized manager with utility methods for easy spawning and includes proper cleanup mechanisms.


## Testimonials

> "This project is overengineered compared to the expectations—thousands of lines of cohesively written, robust systems. I have nothing bad to say."
>
> — **Course Instructor**, C# Programming Course - Futuregames

> "You worked very autonomously and put in a lot of effort in so many areas. The game is fun to play, I never once ran into an obvious bug or issue, and all features are there with extra polish."
>
> — **Course Instructor**, C# Programming Course - Futuregames

> "Your coding skills are excellent. You're at the stage where you can focus on overall system architecture and a specialization path—gameplay, tools, or engine development. I see you having no issue succeeding in any of them."
>
> — **Course Instructor**, C# Programming Course - Futuregames
