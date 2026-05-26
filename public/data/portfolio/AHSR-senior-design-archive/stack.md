# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|---|---|---|---|
| Middleware | ROS2 | Humble Hawksbill | Real-time-ish pub/sub for the camera/SLAM/Nav2/safety nodes plus wireless DDS for the operator GUI — all out of the box |
| Language (primary) | Python | 3.10+ | Fast iteration on perception and GUI code; `rclpy` is the canonical ROS2 binding |
| Language (drivers) | C++ | 17 | Lower-level diff-drive controller and parts of the vendored `ros2_control` stack |
| Build system | colcon | (ROS2 default) | Standard ROS2 workspace builder; handles the multi-package `robot_ws/` and `sim_ws/` cleanly |

## Perception

- **Computer Vision**: OpenCV (lower-body classifier + depth-aligned filtering) via `opencv-python`
- **RGB-D Camera**: Intel RealSense D435, driven by `OrbbecSDK_ROS2` (upstream fork, vendored in `OrbbecSDK_ROS2/`)
- **Lidar**: 2D laser scanner driven by `rplidar_ros2` (upstream fork, vendored in `rplidar_ros2/`)

## Navigation & SLAM

- **SLAM**: SLAM Toolbox in online async mode (configuration in `cartographer/`)
- **Path planning + recovery**: Nav2 stack with `NavfnPlanner` global + `DWB` local controller (`navigator/`, `robot_ws/`)
- **Frontier exploration**: Custom node in `auto-mapper/`; built on top of Nav2 + the live occupancy grid

## Robot Control

- **Diff-drive controller**: `ros2_control` + `ros2_controllers` (upstream forks, vendored in `ros2_control/`, `ros2_controllers/`, `ros2_control_demos/`)
- **Velocity multiplexer**: `twist_mux` (configured in `robot_ws/`) arbitrates Nav2 / operator / safety stop by priority
- **URDF / description**: Single robot description in `ahsr_bot_description/`, shared between sim and hardware

## Operator Interface

- **GUI framework**: PyQt5 (in `ahsr_UI/`)
- **ROS2 binding**: `rclpy` subscribed directly to the robot's topic graph over wireless DDS
- **Trip logging + replay**: Custom in `logging_script/` and `Time-Log/`

## Simulation

- **Simulator**: Gazebo Classic
- **Worlds + launch**: `sim_ws/`
- **Hardware/sim parity**: Same URDF, same launch files, switched via `use_sim_time:=true`

## Hardware

- **Compute**: Jetson Nano (ROS2 Humble on Ubuntu 20.04)
- **Chassis**: Yahboomcar platform (Yahboom-supplied code in `yahboomcar_code/` and `yaboomcar_ws-unzipped/`)
- **Sensors**: 2D lidar, Intel RealSense D435, IMU, wheel encoders
- **Emergency stop**: Hardware kill switch in addition to the software safety override

## Infrastructure

- **Source control**: Git (21 sub-repos under the CD1-ARHS GitHub org, subtree-merged into this archive)
- **CI/CD**: None — the team built and tested locally per ROS2 workspace
- **Deployment**: Manual `colcon build` + `ros2 launch` on the robot's Jetson Nano

## Key Dependencies

| Package | Purpose |
|---|---|
| `slam_toolbox` | 2D lidar SLAM with loop closure |
| `nav2_*` (planner, controller, recoveries, bt_navigator) | Path planning, local control, recovery behaviors |
| `ros2_control` + `ros2_controllers` | Hardware interface and diff-drive controller |
| `twist_mux` | Velocity-source arbitration |
| `opencv-python` | Lower-body detector + depth gating |
| `OrbbecSDK_ROS2` | RealSense camera driver |
| `rplidar_ros2` | 2D lidar driver |
| `PyQt5` | Operator GUI framework |
| `rclpy` | ROS2 Python binding |
| `gazebo_ros` | Simulation environment |

## Archive Notes

- The 6 directories `ros2_control/`, `ros2_controllers/`, `ros2_control_demos/`, `OrbbecSDK_ROS2/`, `ros2_explorer/`, and `rplidar_ros2/` are **upstream forks** the team pinned for compatibility. They're marked `linguist-vendored=true` in `.gitattributes` so they don't skew the repo's language statistics.
- The 15 other directories contain team-written code, totaling ~632k lines of Python, JSON config, URDF/XML, YAML, C, C++, CMake, and shell across the 2-year project.
- All 21 sub-repos retain their full commit history via `git subtree`; inspect a specific sub-repo's log with `git log -- <prefix>/`.
