# Technology Stack

## Core Technologies

### ROS2 (Robot Operating System 2)
- **Version**: Humble Hawksbill
- **Purpose**: Middleware for robotics applications
- **Features Used**: Topics, Services, Actions, Launch files

### Python
- **Version**: 3.10+
- **Purpose**: Primary development language
- **Libraries**: NumPy, OpenCV, PyQt5

## Computer Vision

### OpenCV
- RGB-D image processing
- Lower-body detection using pretrained models
- Depth image analysis for obstacle avoidance

### Intel RealSense SDK
- RGB-D camera integration
- Depth stream capture
- Point cloud generation

## Navigation & SLAM

### Nav2 (Navigation Stack)
- Path planning algorithms
- Costmap generation
- Recovery behaviors

### SLAM Toolbox
- Lidar-based mapping
- Localization
- Map saving/loading

## User Interface

### PyQt5
- Cross-platform GUI framework
- Real-time data visualization
- Waypoint management interface

### Wireless Communication
- ROS2 DDS for wireless connectivity
- Low-latency control commands
- Status monitoring

## Hardware Integration

### Sensors
- **Lidar**: 2D laser scanner for mapping
- **RGB-D Camera**: Intel RealSense D435
- **IMU**: Inertial measurement unit
- **Encoders**: Wheel odometry

### Actuators
- **Motors**: DC motors with encoders
- **Motor Controllers**: PWM-based control
- **Emergency Stop**: Hardware safety cutoff
