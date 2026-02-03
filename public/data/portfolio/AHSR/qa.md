# Q&A

## What was your role in this project?
I served as **Software Lead** for the AHSR (Autonomous Hospital Stretcher Robot) project, a University of Florida Senior Design project spanning from January 2023 to December 2024. I was responsible for architecting the software systems, leading integration efforts between subsystems, and implementing key features including the computer vision safety system and navigation stack.

## What problem does AHSR solve?
Hospital staff frequently transport patients on stretchers through busy corridors, which is physically demanding and diverts medical personnel from patient care. AHSR automates this process by providing an autonomous stretcher that can navigate hospital environments safely. The robot uses SLAM-based navigation for path planning and a computer vision safety system that monitors for lower-body obstructions to prevent collisions with people.

## What were the most challenging technical aspects?

### Real-Time Safety Override System
Implementing a reliable safety system that could detect lower-body obstructions (legs, feet, wheelchairs) in real-time was critical. We used an Intel RealSense D435 RGB-D camera with custom OpenCV processing to analyze both color and depth data. The challenge was achieving low-latency detection while minimizing false positives that would constantly stop the robot.

### SLAM in Dynamic Hospital Environments
Hospital corridors are highly dynamic with people, equipment, and doors constantly changing. We implemented frontier-based exploration combined with SLAM Toolbox to build and update maps while handling dynamic obstacles. The Lidar-based mapping had to distinguish between permanent structures and temporary obstacles.

### Wireless Control Reliability
The PyQt5 control interface needed to maintain reliable wireless communication with the robot. We used ROS2's DDS middleware to handle network variability while ensuring emergency stop commands were always delivered with minimal latency.

## What technologies did you use and why?

- **ROS2 Humble**: Chosen for its mature robotics ecosystem, real-time capabilities, and strong support for multi-process communication through DDS.
- **OpenCV with Python**: Enabled rapid prototyping of vision algorithms while leveraging pretrained models for person detection.
- **Nav2 Navigation Stack**: Industry-standard navigation solution that integrates path planning, costmaps, and recovery behaviors.
- **PyQt5**: Cross-platform GUI framework that allowed us to build a professional control interface while maintaining compatibility with ROS2.

## What would you do differently?

1. **Earlier Hardware-Software Integration**: We spent significant time developing in simulation before integrating with hardware. Starting hardware integration earlier would have surfaced real-world challenges sooner.

2. **More Robust Sensor Fusion**: While our Lidar + RGB-D combination worked well, adding wheel odometry fusion earlier would have improved localization accuracy in feature-sparse corridors.

3. **Modular Testing Framework**: We would implement more comprehensive unit tests for individual ROS2 nodes to catch integration issues before full system testing.

## What was the outcome?
The project was successfully demonstrated at the University of Florida Senior Design Showcase. The robot achieved autonomous navigation through a simulated hospital corridor environment, correctly detecting and stopping for lower-body obstructions in all test scenarios. The wireless control interface allowed operators to set waypoints, monitor robot status, and trigger emergency stops reliably.
