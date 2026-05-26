# Project Q&A

## Overview

The **Autonomous Hospital Stretcher Robot (AHSR)** is a 2-year senior design project at the University of Florida (Jan 2023 – Dec 2024) that builds a self-navigating hospital stretcher. It uses ROS2 for middleware, SLAM Toolbox for mapping, and an Intel RealSense D435 RGB-D camera for a lower-body computer-vision safety override that stops the robot before it hits anyone. A PyQt5 wireless control interface lets an operator set waypoints, monitor robot status, and trigger an emergency stop. The interesting bit is the safety system: it fuses depth and color to detect feet and legs specifically, so the robot can move through a busy hospital corridor without false-stopping on every distant body in view.

I was the **Software Lead** on the CD1-ARHS team, responsible for the software architecture, subsystem integration, and key features including the safety vision pipeline and the navigation stack.

## Problem Solved

Hospital staff transport patients on stretchers through busy corridors many times a day. It's physically demanding, takes nurses and orderlies away from actual patient care, and is repetitive enough that it screams for automation. AHSR provides an autonomous stretcher that can navigate hospital environments on its own, with a safety system aggressive enough to be trusted around people but not so aggressive that the robot freezes constantly. The wireless GUI keeps a human in the loop for waypoint selection and override.

## Target Users

- **Hospital staff (nurses, orderlies)** — set a destination on the GUI, push go, and let the stretcher handle the corridor traversal while they focus on patient care
- **Robotics engineers** — the architecture (perception → SLAM → Nav2 → wheel control) is a useful reference for an end-to-end ROS2 mobile robot on commodity hardware
- **Senior design teams reading the archive** — the full 21-repo subtree-merged history shows how a multi-person robotics team actually built and integrated a system over 2 years

## Key Features

### Autonomous SLAM-based navigation
Lidar + IMU + wheel encoders feed SLAM Toolbox, which builds and updates a 2D occupancy map in real time. Nav2 plans paths against that map and handles recovery behaviors (rotate-in-place, backtrack) when blocked. The robot starts with no map of the room and frontier-explores until coverage is sufficient.

### Lower-body safety override
An Intel RealSense D435 streams RGB + depth at 30fps. An OpenCV pipeline runs a pre-trained lower-body detection model on the color frame, then uses the aligned depth frame to filter out detections outside the robot's stopping distance. A positive detection inside the danger cone publishes an emergency stop on the ROS2 cmd_vel topic, overriding Nav2.

### Wireless waypoint control
A PyQt5 GUI runs on a laptop and communicates with the robot via ROS2 DDS. Operators click a point on the live map, the robot routes to it via Nav2, and trips are logged so they can be replayed later. Emergency stop is wired separately from the normal control path so it works even if Nav2 is wedged.

### Trip logging and replay
Every commanded waypoint, robot pose, and safety-stop event is logged with timestamps. A replay tool reconstructs the trip on the same map for debugging — useful when "the robot stopped for no reason" turns out to mean "the camera saw a lab chair leg."

## Technical Highlights

### Depth-gated person detection
A pure RGB person-detection model triggers on anyone in frame, including someone 20 feet away across the corridor — which would cause the stretcher to never move. The solution is to gate detections by the aligned depth frame: a bounding box is only treated as a safety event if its median depth value falls inside the robot's stopping distance (roughly 1.5m). Same model, dramatically lower false-positive rate, and the trade-off (a person sprinting from far away might not get flagged in time) is bounded by the robot's max velocity.

### Frontier-based exploration over pre-mapped operation
Hospital floor plans are not always available, and even when they are, doors move, equipment rolls, and rooms get reconfigured. Rather than depending on a pre-built map, the robot does frontier exploration on first deployment: SLAM Toolbox builds the map as the robot drives boundaries between known-free and unknown space. Re-running coverage is cheap; this also means a corridor used by patients constantly stays accurately represented over time.

### Safety stop on a separate publisher
The emergency-stop command bypasses Nav2's command stack and publishes directly to the velocity multiplexer at a higher priority. So even if the navigation stack is in a weird state (recovering, lost localization, deadlocked behavior tree), the stop command still gets through. This is a small architectural decision but it's what made the robot demo-able with humans walking near it.

### Sim-first development workflow
The team built a Gazebo simulation of a hospital corridor early (`sim_ws/`), which let us iterate on the navigation and safety logic without burning battery time or risking the physical robot. The URDF in `ahsr_bot_description/` is shared between sim and real-hardware launch files so the same code runs on both with one launch-arg difference.

## Engineering Decisions

### ROS2 (Humble) over ROS1 or a custom middleware
- **Constraint**: We needed real-time-ish multi-process communication between the camera node, SLAM, Nav2, the safety detector, and the GUI — plus wireless DDS handoff to the operator laptop.
- **Options**: ROS1 Noetic (more mature ecosystem at start of project); ROS2 Humble; a hand-rolled gRPC/ZeroMQ setup.
- **Choice**: ROS2 Humble.
- **Why**: ROS1's lifecycle was ending and Nav2 was already ROS2-native. DDS gives wireless out of the box. The custom middleware option would have meant rebuilding navigation primitives we'd otherwise get from Nav2 for free.

### RGB-D camera over pure lidar for safety
- **Constraint**: The lidar is 2D and mounted low — it sees obstacles in its scan plane but is blind to suspended objects (a person leaning over the stretcher, an arm) and to texture cues that distinguish "person" from "cart."
- **Options**: Multiple stacked lidars; sonar curtain; RGB-D camera; thermal camera.
- **Choice**: Intel RealSense D435 RGB-D, depth-aligned with a CV pipeline.
- **Why**: One sensor gives us 3D obstacle data AND color for human detection. The depth gate filters distant people without losing close ones. RealSense was within budget and had ROS2 drivers available.

### Decouple safety stop from Nav2's command path
- **Constraint**: Nav2's behavior tree can get into states (recovery loops, costmap-stale, localization-lost) where it stops emitting velocity commands. If safety stop went through Nav2, those states would make safety stop unreliable.
- **Options**: Trust Nav2 to handle safety as a behavior; publish stop on cmd_vel and rely on first-writer-wins; use a velocity multiplexer with explicit priorities.
- **Choice**: `twist_mux` (ROS2 velocity multiplexer) with the safety topic at the highest priority above Nav2 and the GUI.
- **Why**: Safety stop is now a separate publisher that wins by design. The behavior is deterministic regardless of what Nav2 is doing.

### PyQt5 over a web UI for the operator interface
- **Constraint**: The operator station is a laptop on the same wireless network as the robot. It needs to render the live map and receive ROS2 messages, but doesn't need to be remote-accessible.
- **Options**: PyQt5 desktop app; web UI served by a Flask/FastAPI backend; rviz2 with custom panels.
- **Choice**: PyQt5 with `rclpy` directly subscribed to ROS2 topics.
- **Why**: One process, no extra middleware between the operator and the robot. The wireless DDS connection is the same one the robot uses internally — no rewriting messages for HTTP. rviz2 was rejected because we needed custom waypoint workflows that don't fit its panel model.

## Frequently Asked Questions

### How does the safety system handle moving people?
The detection runs at the camera's frame rate (~30 fps), and the depth gate uses the median depth of the detected bounding box. A person walking across the robot's path enters the danger zone for several frames before they're at impact range — that's enough for the stop command to publish and the wheels to decelerate. The bigger concern is someone *sprinting* directly at the robot from outside the depth gate, which is why we cap the robot's max velocity to a value where the stopping distance fits inside the safety cone.

### Why frontier exploration if hospitals have floor plans?
Floor plans are often outdated by months or years — beds move, partitions get added, equipment carts park in hallways. A frontier-explored map made today is more accurate than a CAD drawing made in 2018. The exploration only takes a few minutes for a typical corridor, and the same approach handles re-mapping when the environment changes.

### What happens if the wireless link drops?
The robot keeps executing its current Nav2 goal — it doesn't stop just because the GUI disappeared. If you want it to stop on link loss, the operator presses the emergency-stop button, which publishes a one-shot stop. There's also a hardware kill switch on the chassis as a last resort. We deliberately chose not to make link-loss = auto-stop because in a hospital that would mean the robot freezes whenever someone walks between it and the WiFi AP.

### How is the archive organized?
The archive subtree-merges 21 sub-repos from the CD1-ARHS team. Team-written code lives in `ahsr_bot/`, `ahsr_bot_description/`, `ahsr_UI/`, `navigator/`, `orbbec_vision/`, `sim_ws/`, `auto-mapper/`, `cartographer/`, `robot_ws/`, `logging_script/`, `Time-Log/`, and a few others. The 6 public upstream forks (`ros2_control*`, `OrbbecSDK_ROS2`, `ros2_explorer`, `rplidar_ros2`) are kept for reproducibility and are marked `linguist-vendored` in `.gitattributes` so they don't pollute the language statistics. Each sub-repo's full commit history is reachable via `git log -- <prefix>/`.

### Can the same software run in simulation?
Yes — the URDF in `ahsr_bot_description/` is shared between sim and hardware. The launch files take a `use_sim_time:=true` argument that swaps Gazebo's clock in for the system clock; everything else (Nav2, the safety pipeline, the GUI) is unchanged. We built every feature in sim first and then validated on hardware, which let us iterate without burning robot battery time.

### What hardware does the robot run on?
A Yahboomcar chassis with an onboard Jetson Nano running ROS2 Humble. The lidar is a 2D scanner; the RGB-D is an Intel RealSense D435; wheel odometry comes from encoders feeding `ros2_control` (which is why the upstream `ros2_control` and `ros2_controllers` forks are in the archive — they were pinned versions the rest of the stack depends on).

### Is the project finished?
The system was demonstrated at the University of Florida Senior Design Showcase in December 2024 with successful autonomous navigation through a simulated hospital corridor environment, correct lower-body detection in all test scenarios, and reliable wireless operator control. The archive captures the state of the work at that demo — see [README.md](../README.md) for the layout.
