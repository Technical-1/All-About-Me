# Technology Stack

## Core Technologies

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| Language | Python | 3.x | Primary development language |
| Notebook | Jupyter | - | Interactive development environment |
| ML Framework | TensorFlow/Keras | 2.x | Neural network implementation |

## Data Processing

- **DataFrame Library**: Pandas - tabular data manipulation and cleaning
- **Numerical Computing**: NumPy - array operations and mathematical functions
- **ML Utilities**: scikit-learn - KMeans clustering, MinMaxScaler, train_test_split

## Visualization

- **Static Plots**: Matplotlib + Seaborn - histograms, scatter plots, heatmaps, bar charts
- **Interactive Maps**: Folium - geospatial visualization with cluster markers and layer controls

## Machine Learning

- **Preprocessing**: scikit-learn
  - `KMeans` for geographic clustering
  - `MinMaxScaler` for feature normalization
  - `train_test_split` for data splitting
- **Model**: TensorFlow/Keras
  - `Sequential` model architecture
  - `Dense` layers with ReLU activation
  - Built-in callbacks for early stopping and LR scheduling

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `pandas` | Data loading, cleaning, and feature extraction |
| `numpy` | Haversine distance calculation, array operations |
| `matplotlib` | Base plotting library for visualizations |
| `seaborn` | Statistical visualization (KDE plots, heatmaps) |
| `folium` | Interactive maps with FastMarkerCluster |
| `scikit-learn` | KMeans, MinMaxScaler, train_test_split, MAE metric |
| `tensorflow` | Neural network model, callbacks, training loop |

## Development Environment

- **Package Manager**: pip
- **Runtime**: Jupyter Notebook / JupyterLab
- **Data Storage**: Local CSV file (~5.5GB training data)

## Why These Choices?

### TensorFlow over PyTorch
TensorFlow's Keras API provides a simple, declarative syntax ideal for straightforward sequential models. The callback system (EarlyStopping, ReduceLROnPlateau) is particularly clean for managing training dynamics.

### Folium for Maps
Folium wraps Leaflet.js and integrates naturally with Jupyter notebooks, rendering interactive maps inline without requiring a separate frontend.

### scikit-learn for Preprocessing
Industry-standard library with consistent API. KMeans and MinMaxScaler fit/transform pattern works well with Pandas DataFrames and integrates cleanly with the TensorFlow pipeline.
