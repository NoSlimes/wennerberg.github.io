---
pageTitle: Project - TAMASHII
heroImage: /assets/projects/tamashii/tamashii.png
heroVideoUrl: "https://download.noslimes.com/Futuregames/GP4/Trailer_Tamashii_1min.mp4"
projectName: TAMASHII
projectType: "[GAME PROJECT 4 - FUTUREGAMES]"
flairs:
  - Unreal Engine 5
  - Blueprints
  - C++
  - Group Project
  - Futuregames
projectInfo:
  Team Size: 11
  Engine: Unreal Engine 5
  Language: C++, Blueprints
  Duration: "4 weeks"
highlights:
  - Implemented the tether system and 3D movement bounds volumes for the players.
  - Built and tuned player movement features including wall jump and double jump.
---

Tamashii is a 2.5D co-op platformer built in Unreal Engine 5 where both players are linked by a tether. The main technical challenge was balancing physical coupling with responsive controls so the tether creates meaningful cooperation without making traversal feel unstable.

## My Role

- Implemented the tether system and 3D movement bounds volumes for the players.
- Developed core movement behavior, including wall jump and double jump.

## Tether Mechanic

The tether is Tamashii's core gameplay system. Because both players are mechanically coupled, one player's acceleration, jump timing, and position directly affects the other player's movement outcome. 

Early prototypes used a high-strength tether that allowed hanging and swinging with it. While that version was the initial vision, time constraints proved it difficult to tune it and develop puzzles around it. 

In the end, the tether still contributes pull and recovery assistance, but is no longer strong enough to allow the players to swing.

## Player Movement

I implemented movement behavior around tether constraints, including jump handling, wall jumps, and double jumps. 