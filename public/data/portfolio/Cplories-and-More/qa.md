# Project Q&A

## Overview

C++lories & More is a command-line meal planner that turns the USDA National Nutrient Database into a personalized five-day meal plan. Under the hood, it's a data-structures study: instead of using the STL's associative containers, I implemented an ordered map (a binary search tree) and an unordered map (a separately-chained hash table) from scratch, and the program benchmarks them against each other on real ingredient lookups. The nutrition app is the realistic workload that gives the comparison teeth.

## Problem Solved

Two problems, really. The surface problem: building a sensible weekly meal plan by hand is tedious — you have to balance calorie targets, portion sizes, and food preferences. The underlying problem the project was built to explore: *when does an ordered map beat an unordered map, and by how much?* Wiring the data structures into a real application with thousands of lookups answers that empirically instead of from a textbook table.

## Target Users

- **Someone planning meals around a calorie goal** — gets a five-day plan tailored to their body metrics and lose/gain target, with foods they're allergic to or dislike filtered out.
- **A student or engineer studying associative containers** — gets a working, readable implementation of a BST-backed map and a hash-table-backed map plus a built-in benchmark to compare them.

## Key Features

### Personalized meal planning
The program collects sex, weight, height, age, and activity level, computes a daily calorie target, and assembles breakfast/lunch/dinner for five days that fit the budget.

### Dietary restriction filtering
Any ingredient you list is matched as a substring against each candidate meal's ingredients; meals that contain a restricted item are skipped during curation.

### Built-in data-structure benchmark
Menu option 5 runs a lookup and an insert on both the ordered and unordered maps for an ingredient you choose, timing each with `std::chrono` and printing the microsecond cost side by side.

### From-scratch containers
Both maps are hand-implemented — the BST handles the ordered case, and the hash table with separate chaining and dynamic rehashing handles the unordered case.

## Technical Highlights

### CSV parsing that survives commas inside quoted fields
The USDA flat file contains descriptions like `"cheese, swiss"` where commas appear *inside* a quoted field. A naïve `getline(stream, word, ',')` would shred those rows. `checkForQuotes` (in `main.cpp`) peeks for a leading quote and, when it finds one, uses `std::quoted` to read the whole quoted token before discarding up to the next delimiter — so quoted and unquoted columns both parse correctly.

### Load-factor-driven rehashing in the hash table
`UnorderedMap` starts with 1,000 buckets and tracks `numOfItems / bucketSize`. When the load factor reaches the 0.8 threshold, it doubles the bucket count and `rehash()` re-inserts every existing element into the larger table (`UnorderedMap.cpp`). This keeps average chain length bounded as the ~8,800 foods are inserted, which is what preserves near-constant lookup time.

### Calorie math normalized to per-100g
USDA reports calories per 100 grams, but meals are defined in real serving sizes. The map stores the canonical per-100g value, and `curatePlanUnordered` multiplies by `grams / 100` when summing each meal — so one ingredient can appear in several meals at different quantities without duplicating data.

### Calorie-window fit with anti-repetition
Meal selection accepts a candidate only if its total lands between half and all of the per-meal budget (rejecting both over-budget and trivially-light meals), and once chosen, the meal is erased from its template pool so it can't recur later in the week.

## Engineering Decisions

### Hand-written maps instead of `std::map` / `std::unordered_map`
- **Constraint**: The goal was to understand the cost model of associative containers, not just call into the STL.
- **Options**: Use the STL containers; implement only one structure; implement both.
- **Choice**: Implement both a BST-backed ordered map and a chained hash-table unordered map, and route all real lookups through them.
- **Why**: Owning the implementations is what makes the benchmark honest — it measures my tree traversal against my hash-and-chain, on identical data, rather than asserting Big-O from a reference.

### Separate chaining over open addressing
- **Constraint**: Collisions are inevitable with a simple character-sum hash.
- **Options**: Open addressing (linear/quadratic probing) or separate chaining.
- **Choice**: Separate chaining with a `std::forward_list` per bucket, plus table doubling at a 0.8 load factor.
- **Why**: Chaining is simpler to reason about, never suffers from clustering or tombstones, and a singly-linked list is the lightest possible chain node — and rehashing on load keeps the chains short.

### Loading the dataset into both maps at startup
- **Constraint**: The benchmark only means something if both structures hold exactly the same data.
- **Options**: Build one map and convert; build them lazily; build both eagerly during ingestion.
- **Choice**: Insert every parsed food into both maps in the same ingestion loop.
- **Why**: Guarantees a fair, identical workload for the timing comparison and keeps the data-loading code in one place.

## Frequently Asked Questions

### How does the calorie target get computed?
`calculateAMR` converts weight to kilograms and height to centimeters, computes Basal Metabolic Rate from a sex-specific formula over weight/height/age, multiplies by an activity factor between 1.2 (sedentary) and 1.9 (very active), then adds or subtracts 500 kcal depending on whether you want to gain or lose.

### Why is the ordered map a plain BST and not a balanced tree?
It's an unbalanced binary search tree — the simplest correct ordered structure. That keeps the implementation readable and makes the comparison against the hash table a clean "tree depth vs. chain length" story. A self-balancing tree (AVL/red-black) would tighten the worst case but wasn't needed to demonstrate the ordered-vs-unordered trade-off.

### How does the hash function work?
It sums the integer code points of every character in the key and reduces that modulo the bucket count. It's intentionally simple; the separate-chaining + rehashing design is what absorbs its collisions.

### Why are the meals hard-coded instead of generated from the database?
The meal *templates* (ingredient lists and gram quantities) are curated by hand for realism, but their calorie totals are computed live from the database. This separates "what's in a dish" (a human judgment) from "how many calories that is" (a data lookup).

### Can I add my own ingredient at runtime?
Yes — the benchmark menu lets you insert an ingredient into both maps and reports how long each insert took. Inserts don't persist, though; everything is rebuilt from the CSV on the next run.

### Why does the plan only cover Monday through Friday?
The curation loop builds five days, and because each selected meal is removed from the pool, the template tables are sized to comfortably supply a work-week without repeats.

### Do I need the CSV file to run it?
Yes. The program reads `nndb_flat.csv` from the working directory at startup; run the binary from the directory that contains it.
