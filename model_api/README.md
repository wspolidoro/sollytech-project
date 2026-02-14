# Sollychain ML Dashboard

## Overview

This project is a web-based machine learning dashboard developed in Go that allows users to upload a dataset in CSV format, select a target variable, and train classification models. The application provides evaluation metrics including accuracy, confusion matrix, and per-class performance metrics.

The system is designed with a simple workflow:

1. Upload a CSV dataset.
2. Select the target column to be predicted.
3. Train machine learning models.
4. Visualize training results and evaluation metrics.

---

## Technical Requirements

Before running the project, ensure the following dependencies are installed.

### 1. Go (Golang)

The application is implemented in Go.

Minimum recommended version:

```
Go 1.20 or higher
```

Installation instructions:

* Download from: https://go.dev/dl/
* After installation, verify:

```bash
go version
```

---

### 2. Environment Variables (Optional)

If your environment requires custom configuration (such as port selection), you may configure environment variables before execution. Otherwise, the default configuration will be used.

---

## Project Structure

A typical project structure is organized as follows:

```
project/
│
├── main.go
├── models/
├── templates/
│   ├── index.html
│   ├── target.html
│   └── result.html
├── static/
│   └── style.css
├── uploads/
└── go.mod
```

Description:

* `main.go`: Application entry point.
* `models/`: Storage for downloaded models files.
* `templates/`: HTML templates rendered by the server.
* `static/`: CSS and static assets.
* `uploads/`: Temporary storage for uploaded CSV files.

---

## Installation and Execution

### Step 1 — Clone or Download the Repository

```bash
git clone <repository-url>
cd <project-folder>
```

If you received the project as a compressed file, extract it and navigate to the directory.

---

### Step 2 — Install Dependencies

Initialize Go modules and download dependencies:

```bash
go mod tidy
```

---

### Step 3 — Run the Application

Start the server:

```bash
go run main.go
```

---

### Step 4 — Access the Web Interface

Open a browser and navigate to:

```
http://localhost:8080
```

If a different port is configured, use the corresponding address.

---

## Usage Guide

### 1. Upload Dataset

* On the main page, select a CSV file containing your dataset.
* The file must include a header row with column names.
* After upload, the system will parse the dataset and extract available columns.

### 2. Select Target Column

* The application will display all detected columns.
* Choose the column representing the prediction target (class label).
* Submit the form to initiate model training.

### 3. Model Training

The system automatically:

* Splits the dataset into training and testing subsets.
* Trains one or more classification models.
* Computes evaluation metrics.

### 4. Results Visualization

The results page displays:

* Model name
* Accuracy score
* Confusion matrix
* Per-class metrics:

  * Precision
  * Recall
  * F1-score
  * True Positives (TP)
  * False Positives (FP)
  * False Negatives (FN)

---

## Supported Dataset Format

Requirements for CSV files:

* Comma-separated values.
* Header row required.
* Numeric or categorical features supported.
* Target column must contain discrete class labels.

Example:

```
age,income,gender,bought
25,50000,M,Yes
30,60000,F,No
...
```

---

## Troubleshooting

### Port Already in Use

If port 8080 is occupied, modify the server port in the source code or terminate the conflicting process.

### CSV Parsing Errors

Ensure:

* The file uses UTF-8 encoding.
* There are no malformed rows.
* All rows contain the same number of columns.

### Dependency Issues

Run:

```bash
go clean -modcache
go mod tidy
```

---

## Author

**Carlos Augusto R. de Oliveira**
📧 Email: [caruviaro@outlook.com](mailto:caruviaro@outlook.com)
