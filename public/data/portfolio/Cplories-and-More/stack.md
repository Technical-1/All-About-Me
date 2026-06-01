# Tech Stack

## Core Technologies

| Category | Technology | Version | Why this choice |
|----------|------------|---------|-----------------|
| Language | C++ | C++14 standard | Course requirement; gives manual memory/pointer control needed to implement the data structures by hand |
| Build | CMake | ≥ 3.21 | Cross-platform build that the JetBrains CLion toolchain (used by the team) generates and consumes natively |
| Data | USDA National Nutrient Database | `nndb_flat.csv` | Real, sizable (~8,800-row) dataset that makes the ordered-vs-unordered benchmark meaningful |

## Application

- **Interface**: Text-based CLI with a numbered menu loop (`std::cin`/`std::cout`)
- **Entry point**: `main.cpp`
- **Persistence**: None — data is loaded fresh from the CSV into in-memory maps each run

## Data Structures (implemented from scratch)

- **Ordered map**: Binary search tree keyed on lowercased food description (`Map`)
- **Unordered map**: Hash table with separate chaining and load-factor-driven rehashing (`UnorderedMap`)
- **Hash function**: Sum of character code points, reduced modulo bucket count
- **Collision strategy**: Separate chaining with `std::forward_list` per bucket

## Key Standard-Library Dependencies

| Header | Purpose |
|--------|---------|
| `<chrono>` | High-resolution timing for the ordered-vs-unordered map benchmark (microsecond resolution) |
| `<forward_list>` | Singly-linked bucket chains in the unordered map |
| `<sstream>` + `std::quoted` | Parsing CSV fields, including quoted values that contain commas |
| `<algorithm>` | `std::transform` for lowercasing keys; `std::shuffle` for varying meal order |
| `<vector>` | Bucket array and the hard-coded meal-template tables |

## Build & Tooling

- **Build system**: CMake (`CMakeLists.txt` defines a single executable target from the three translation units)
- **Compiler**: Any C++14 compiler — verified with the GCC/Clang toolchains
- **Testing**: None automated — the small surface area was verified interactively, and the benchmark menu doubles as a manual correctness/performance check
- **IDE**: JetBrains CLion (the committed `cmake-build-debug/` artifacts reflect its default debug profile)
