# Architecture

## System Diagram

```mermaid
flowchart TD
    CSV["nndb_flat.csv\n(USDA Nutrient DB)"] -->|getline + checkForQuotes| Parse["CSV parser\n(main.cpp)"]
    Parse -->|description → kcal/100g| Ordered["Ordered Map\n(BST — Map.cpp)"]
    Parse -->|description → kcal/100g| Unordered["Unordered Map\n(hash table — UnorderedMap.cpp)"]

    Menu["CLI menu loop\n(main.cpp)"] --> Health["Health inputs\n(sex, weight, height, age, activity)"]
    Health --> AMR["calculateAMR()\nBMR × activity ±500 kcal"]
    AMR --> Curate["curatePlanUnordered()\nmeal selection"]
    MealTemplates["Hard-coded meal templates\n(breakfast / lunch / dinner)"] --> Curate
    Unordered -->|per-ingredient lookup| Curate
    Curate --> Plan["5-day meal plan output"]

    Menu --> Bench["Benchmark (option 5)"]
    Ordered -->|findValue| Bench
    Unordered -->|operator[]| Bench
    Bench --> Timing["chrono µs comparison"]
```

## Component Descriptions

### Ordered Map (`Map`)
- **Purpose**: Associative container that keeps keys in sorted order; the "tree-based" half of the comparison.
- **Location**: `Map.h`, `Map.cpp`
- **Key responsibilities**: Unbalanced binary search tree keyed on the lowercased food description. `insert` descends recursively (`insertKeyValueHelper`) and rejects duplicate keys; `findValue` walks the tree iteratively (`findHelper`), returning `-1.0` and printing a miss when the key is absent.

### Unordered Map (`UnorderedMap`)
- **Purpose**: Hash-based associative container; the "constant-time" half of the comparison.
- **Location**: `UnorderedMap.h`, `UnorderedMap.cpp`
- **Key responsibilities**: Separate chaining via `vector<forward_list<pair<string,double>>>` starting at 1,000 buckets. `insert` skips duplicates within a chain and tracks a load factor; when it reaches the 0.8 threshold the table doubles its bucket count and `rehash()` re-inserts every element. `operator[]` hashes the key and scans its chain.

### CSV Ingestion (`checkForQuotes`, `main`)
- **Purpose**: Turn the raw USDA flat file into `(description, calories)` pairs.
- **Location**: `main.cpp`
- **Key responsibilities**: Reads each row, skips the header, lowercases descriptions for case-insensitive matching, and uses `std::quoted` to correctly parse quoted fields that contain commas. Each food is inserted into *both* maps so they can be compared on identical data.

### Calorie Model (`calculateAMR`)
- **Purpose**: Convert user health inputs into a daily calorie target.
- **Location**: `main.cpp`
- **Key responsibilities**: Computes Basal Metabolic Rate from sex/weight/height/age (metric-converted), multiplies by an activity factor (1.2–1.9), and offsets ±500 kcal for a lose/gain goal.

### Meal Curation (`curatePlanUnordered`)
- **Purpose**: Pick meals from templates that fit a per-meal calorie budget and honor restrictions.
- **Location**: `main.cpp`
- **Key responsibilities**: For each meal template, sums ingredient calories by looking up each ingredient's kcal/100g in the unordered map and scaling by its gram quantity. A meal is accepted only if it contains no restricted ingredient and lands inside a calorie window (between half and all of the budget). Selected meals are erased from the pool so they don't repeat across the week.

## Data Flow

1. On startup the program streams `nndb_flat.csv`, parses each row, and inserts `(description → calories per 100g)` into both the ordered and unordered maps.
2. The user fills in dietary restrictions, activity level, and health information through the menu.
3. "Curate Meal Plan" computes the daily calorie target via `calculateAMR`, splits it across breakfast/lunch/dinner, and calls `curatePlanUnordered` for each meal on each of five days.
4. For every candidate meal, ingredient calories are looked up in the unordered map and summed; meals that violate a restriction or fall outside the calorie window are skipped.
5. "Time to Find Ingredient" performs the same lookup/insert on both maps under `std::chrono` timers and prints the microsecond cost of each.

## External Integrations

| Service | Purpose | Notes |
|---------|---------|-------|
| USDA National Nutrient Database | Source of ingredient calorie data | Static `nndb_flat.csv` shipped with the repo; no network calls at runtime |

## Key Architectural Decisions

### Implement both map types from scratch instead of using the STL
- **Context**: The assignment's goal was to understand associative containers, not just consume them.
- **Decision**: Hand-write an ordered map (BST) and an unordered map (hash table), and route the application's real lookups through them. `<map>` appears only behind a "FOR TESTING" include, never in the product path.
- **Rationale**: A from-scratch implementation exposes the actual cost model — tree depth vs. chain length — and lets the program benchmark them on a realistic workload rather than asserting Big-O from a textbook.

### Separate chaining with a forward_list and dynamic rehashing
- **Context**: Collisions are unavoidable, and the dataset size (~8,800 foods) isn't known to be friendly to a fixed table.
- **Decision**: Resolve collisions with per-bucket `std::forward_list` chains, track a load factor, and double the bucket count + rehash when it hits 0.8.
- **Rationale**: Chaining is simple to reason about and degrades gracefully; the singly-linked `forward_list` is the lightest node-based list in the STL, and growing the table keeps average chain length bounded as data is inserted.

### Store calories per 100g and scale by quantity at curation time
- **Context**: USDA reports nutrition per 100 grams, but meals specify real serving sizes.
- **Decision**: Keep the normalized per-100g value in the map and multiply by `grams / 100` when summing a meal's calories.
- **Rationale**: Normalization keeps the data layer pure (one canonical value per food) and pushes portion math to the point of use, so the same ingredient can appear in multiple meals at different quantities.

### Erase a meal from the pool once it's chosen
- **Context**: A weekly plan that suggests the same dish five days running is useless.
- **Decision**: After a meal is accepted for a day, remove it from its template vector so later days can't pick it again.
- **Rationale**: Guarantees variety across the five-day plan without a separate dedup pass, at the cost of mutating the candidate set as the week is built.
