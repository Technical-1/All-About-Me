# Tech Stack

## Core Technologies

| Category        | Technology                    | Why this choice                                                            |
|-----------------|-------------------------------|----------------------------------------------------------------------------|
| Sensor-node lang| C (Pico SDK)                  | Direct register/ADC/UART control on the RP2040 with predictable timing.    |
| Sensor-node lang| Arduino C++                   | Fast bring-up for the light node on Arduino-class hardware.                |
| Coordinator lang| CircuitPython / MicroPython   | High-level WiFi + HTTP on the Feather/ESP32 without a full native toolchain.|
| Coordinator lang| Arduino C++ (ESP8266 core)    | OLED + WiFi on the ESP8266 base station.                                    |
| RF transport    | Digi XBee (802.15.4 / Zigbee) | API mode gives per-node addressing and delivery status.                    |
| Cloud           | ThingSpeak                    | Free, HTTP-GET ingest and built-in charts — minimal coordinator code.      |

## Sensor nodes

- **Temperature**: Raspberry Pi Pico (RP2040), thermistor on a voltage divider into the 12-bit ADC, B-parameter temperature model, oversampled and averaged in `TempNode/main.c`.
- **Light**: Arduino board reading a luminosity sensor, transmitting via `LightNode/LightNode.ino`.
- **Shared protocol**: `xbee_api.h` — hardware-agnostic XBee API frame encode/decode.

## Coordinator / base station

- **Boards**: ESP8266 (`BaseStation.ino`) and Adafruit Feather + ESP32 AirLift co-processor (`FeatherWingFiles/code.py`).
- **Display**: SSD1306 128×32 OLED over I²C (`Adafruit_SSD1306` + `Adafruit_GFX`).
- **Networking**: ESP8266 `WiFi`/`HTTPClient`, or `adafruit_esp32spi` + `adafruit_requests` on the Feather.

## Build & Tooling

- **Pico targets**: CMake + Pico SDK (`CMakeLists.txt`, `pico_sdk_import.cmake`), producing a `.uf2` to flash.
- **Arduino/ESP targets**: Arduino IDE / ESP8266 Arduino core.
- **Hardware design**: KiCad schematics for the base, temp, and light nodes (`Diagrams/schematic/`); data-flow diagram in draw.io.
- **Secrets**: WiFi credentials and the ThingSpeak API key are kept out of the repo (git-ignored `WiFiCredentials.h` / `secrets`).

## Key Dependencies

| Package                         | Purpose                                                       |
|---------------------------------|---------------------------------------------------------------|
| `pico/stdlib`, `hardware/adc`, `hardware/uart` | RP2040 ADC sampling and UART transport.        |
| `Adafruit_SSD1306`, `Adafruit_GFX` | Driving the OLED status display.                           |
| `ESP8266WiFi`, `ESP8266HTTPClient` | WiFi + HTTP on the base station.                           |
| `adafruit_esp32spi`, `adafruit_requests` | WiFi + HTTPS on the Feather coordinator.             |
| `digi-xbee` (Python)            | Host-side frame receive/decode during debugging.             |
