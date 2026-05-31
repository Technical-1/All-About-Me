# Project Q&A

## Overview

A wireless sensor network for EEL4599: small battery-powered nodes measure temperature and light, transmit their readings over XBee 802.15.4 radios as binary API frames, and a WiFi-connected coordinator forwards the data to ThingSpeak for logging and charting. The interesting engineering core is a single portable C header that speaks the full XBee API frame protocol and runs unchanged on two different microcontroller families.

## Problem Solved

Reading sensors in one place and viewing the data somewhere else means crossing two gaps: a wireless RF hop from the sensors to a hub, and an internet hop from the hub to the cloud. This project builds both halves — the RF link between sensor nodes and a coordinator, and the WiFi/HTTP link from the coordinator to ThingSpeak.

## Target Users

- **Students / makers** building multi-node sensor networks who want a worked XBee-API-mode example rather than transparent serial.
- **Anyone wiring a microcontroller to ThingSpeak** who needs a minimal coordinator that turns a UART reading into an HTTP update.

## Key Features

### Multi-node RF sensing
Independent temperature and light nodes each sample a sensor and transmit to a shared coordinator, with the radio's API mode preserving which node sent which reading.

### Portable XBee protocol layer
The framing/checksum logic lives in one header that both the Pico (C) and Arduino nodes include — they differ only in the two UART functions they supply.

### WiFi-to-cloud coordinator
The coordinator reads frames over UART, formats a ThingSpeak `/update` request, and posts it over WiFi, with an OLED showing connection status and IP.

## Technical Highlights

### Hardware-agnostic frame library via injected I/O
`xbee_api.h` implements AT (`0x08`), transmit-request (`0x10`), and receive (`0x90`) frame handling plus checksum compute/verify, but never touches a UART directly — it calls `xbee_api_uart_write()` and `xbee_api_uart_getchar()`, which each firmware defines. On the Pico those map to `uart_write_blocking`/`uart_getc`; on Arduino they map to `Serial.write`/`Serial.read`. One protocol implementation, two toolchains, zero duplication.

### Thermistor math with noise averaging
`TempNode/main.c` converts a 12-bit ADC reading to resistance through the voltage-divider equation, then to temperature with the B-parameter (Steinhart–Hart) model, and finally to Fahrenheit. Rather than transmit a single noisy sample, it accumulates many ADC reads across a fixed time window and averages them before each transmission, trading a little latency for a much steadier reading.

### Compact fixed-point wire format
Each reading is sent as a 2-byte `int16` scaled by 10 (73.4 °F travels as `734`, MSB first) and reconstructed on the receiver. This keeps every payload to exactly two bytes with no string parsing — the receiver code (`SerialReader.c`, `xbee_api_receive.py`) just shifts two bytes back together and divides by 10.

### Defensive frame parsing
The receive path reads the length bytes first and grows its buffer with `realloc` before reading the body, and re-verifies the checksum after assembly. The code comments even flag that trusting attacker-controlled length bytes is a risk — an honest acknowledgement of the parser's threat surface.

## Engineering Decisions

### API mode vs transparent mode
- **Constraint**: One coordinator must distinguish readings from multiple nodes.
- **Options**: Transparent (AT) mode passthrough, or API mode with structured frames.
- **Choice**: API mode.
- **Why**: API receive packets carry the sender's 64-bit address and a delivery status; transparent mode would have flattened all nodes into one indistinguishable byte stream.

### Header-with-callbacks vs per-board protocol copies
- **Constraint**: Two MCU families with incompatible UART APIs must emit identical frames.
- **Options**: Duplicate framing code in each firmware, or isolate it behind an I/O seam.
- **Choice**: Single header with two externally-defined I/O functions.
- **Why**: Eliminates the chance of the temp and light nodes drifting into incompatible frame layouts, and keeps checksum/offset logic in exactly one place.

### ThingSpeak vs a custom backend
- **Constraint**: The coordinator should publish readings with as little code as possible.
- **Options**: Stand up a custom HTTP server/database, or use a hosted IoT data sink.
- **Why**: ThingSpeak ingests data with a single authenticated HTTP GET and charts it out of the box, so the coordinator firmware stays tiny.

## Frequently Asked Questions

### How does a sensor reading get from a node to the cloud?
The node samples its sensor, packs the value into a 2-byte payload, wraps it in an XBee `0x10` transmit frame, and sends it over the radio. The coordinator receives it as a `0x90` packet, extracts the 2 bytes, and issues an HTTP GET to ThingSpeak's `/update` endpoint with the value in a field parameter.

### Why does each node folder have its own `xbee_api.h`?
There's actually only one real file — `TempNode/xbee_api.h` and `LightNode/xbee_api.h` are symlinks to `XBeeAPI/xbee_api.h`. That lets each firmware `#include "xbee_api.h"` locally and pair it with its own `xbee_api_uart_write`/`xbee_api_uart_getchar` implementation, while keeping a single source of truth for the frame format. The header has no platform dependencies of its own — the including file supplies the UART backend before the `#include`.

### How is the temperature actually computed?
ADC counts → resistance via the voltage divider, then resistance → temperature via the B-parameter equation (B = 3435, R₀ = 10 kΩ at 25 °C), converted to Fahrenheit. Readings are oversampled and averaged over a fixed interval before transmission.

### Why send `734` instead of `73.4`?
Fixed-point integers are smaller and unambiguous on the wire. The receiver divides by 10 to recover the decimal value, avoiding floating-point transmission and variable-length strings.

### How is the repository organized?
One directory per network component — `BaseStation/`, `FeatherWingFiles/` (coordinator), `TempNode/`, `LightNode/`, `XBeeAPI/`, `SerialReader/`, and `Diagrams/`. The firmwares use different build systems (Pico SDK/CMake vs Arduino IDE), so each keeps its own build config alongside its source.

### Where do WiFi credentials and the API key live?
Out of the repo. The base station includes a git-ignored `WiFiCredentials.h`, and the CircuitPython coordinator reads from a `secrets` module — neither is committed.

### Can I add a third sensor type?
Yes — write a node that includes `xbee_api.h`, defines the two UART functions for its board, samples its sensor, and calls `xbee_api_transmit_data()` with a 2-byte payload. The coordinator only needs a new ThingSpeak field to chart it.
