# Project Q&A Knowledge Base

## Overview

This project predicts NYC taxi fares using a neural network trained on the Kaggle "New York City Taxi Fare Prediction" dataset. It combines geospatial feature engineering (Haversine distance, location clustering) with temporal features to achieve a validation MAE of ~$1.98 on 1 million trips.

## Key Features

- **Data Cleaning Pipeline**: Robust filtering for outliers, invalid coordinates, and trips outside NYC boundaries
- **Geospatial Feature Engineering**: Haversine distance calculation and KMeans clustering of pickup/dropoff locations
- **Temporal Analysis**: Peak hour detection, hour/day/weekday/month extraction
- **Neural Network Model**: TensorFlow/Keras sequential model with early stopping and learning rate scheduling
- **Interactive Visualizations**: Folium maps, density heatmaps, temporal trend analysis

## Technical Highlights

### Haversine Distance Implementation
I implemented the Haversine formula from scratch using NumPy's vectorized operations. This calculates the great-circle distance between two GPS coordinates, accounting for Earth's curvature. The formula uses the spherical law of cosines and is more accurate than simple Euclidean distance for geographic coordinates.

### KMeans Location Clustering
Rather than using raw latitude/longitude coordinates (which would create a sparse, high-dimensional space), I clustered all pickup and dropoff locations into 5 geographic zones using KMeans. This captures the intuition that certain areas (Manhattan, airports, etc.) have distinct fare patterns, while reducing dimensionality.

### Adaptive Learning Rate Training
The model uses ReduceLROnPlateau callback, which monitors validation loss and reduces the learning rate by 50% when improvement stalls. Combined with early stopping, this prevents overfitting while allowing the model to fine-tune in later epochs.

## Development Story

- **Timeline**: Built as a final project for CAP4770 (Introduction to Data Science)
- **Hardest Part**: Balancing data cleaning aggressiveness - too strict filtering removed too many samples, too lenient included noisy outliers
- **Lessons Learned**: Feature engineering matters more than model complexity for tabular data. The KMeans clusters improved MAE more than adding additional neural network layers.
- **Future Plans**: Could experiment with gradient boosting models (XGBoost, LightGBM) which often outperform neural networks on tabular data

## Frequently Asked Questions

### How does the distance calculation work?
I use the Haversine formula, which calculates the great-circle distance between two points on a sphere. It takes latitude/longitude pairs and returns the distance in kilometers, accounting for Earth's curvature.

### Why did you choose a neural network over other models?
Neural networks handle the non-linear relationships in taxi fare data well, especially interactions between time of day, location, and distance. However, for tabular data like this, gradient boosting models often perform similarly or better - this was primarily a learning exercise.

### How does the model handle peak hours?
I created a binary feature `is_peak_hour` that flags trips during morning rush (7-9 AM) and evening rush (5-10 PM). The model learns that fares during these times tend to be higher due to traffic and demand.

### What was the most challenging part?
Data cleaning was surprisingly nuanced. The raw dataset had trips with negative fares, coordinates in the ocean, and passenger counts of 200+. Deciding on filtering thresholds required balancing data quality against sample size.

### Why use KMeans with 5 clusters specifically?
I experimented with 3-10 clusters. Five provided a good balance - enough granularity to capture distinct NYC neighborhoods (Manhattan, airports, outer boroughs) without creating sparse cluster assignments that would hurt model generalization.

### How would you improve the model?
Three main areas: (1) Add weather data as external features, (2) Try gradient boosting models like XGBoost for comparison, (3) Engineer more features like pickup/dropoff proximity to airports or transit hubs.

### Why is MAE ~$1.98 a good result?
NYC taxi fares typically range from $5-$50. A $1.98 MAE means predictions are off by less than $2 on average, which is roughly the precision of the fare calculation itself (base fare, per-mile rate, waiting time).

### How did you handle the large dataset?
The full dataset is ~55 million rows (~5.5GB). I sampled 1 million rows for development, which provides sufficient statistical power while keeping training manageable. The cleaning pipeline removes ~15-20% of invalid records.
