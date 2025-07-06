# PyTorch AI Microservice

A Python-based microservice that provides PyTorch and Hugging Face model inference capabilities for the Claudate AI framework.

## Features

- **Hugging Face Integration**: Direct access to any HF model
- **Automatic Model Management**: Download, cache, and load models on demand
- **Multiple Model Types**: Text generation, embeddings, classification, etc.
- **GPU Acceleration**: CUDA support for faster inference
- **RESTful API**: Simple HTTP interface for Node.js integration
- **Model Caching**: Intelligent model loading and memory management

## Supported Models

### Text Generation
- `Qwen/Qwen2.5-Coder-7B-Instruct`
- `microsoft/DialoGPT-medium`
- `microsoft/CodeBERT-base`
- Any compatible HF text generation model

### Embeddings
- `sentence-transformers/all-MiniLM-L6-v2`
- `BAAI/bge-large-en-v1.5`
- `Qwen/Qwen2-7B` (with custom embedding extraction)
- Any sentence transformer model

### Specialized Models
- Code analysis models
- Multilingual models
- Domain-specific fine-tuned models

## API Endpoints

### Health Check
```http
GET /health
```

### Text Generation
```http
POST /generate
Content-Type: application/json

{
  "model": "Qwen/Qwen2.5-Coder-7B-Instruct",
  "messages": [
    {"role": "user", "content": "Write a Python function to sort a list"}
  ],
  "max_tokens": 500,
  "temperature": 0.7
}
```

### Embeddings
```http
POST /embeddings
Content-Type: application/json

{
  "model": "sentence-transformers/all-MiniLM-L6-v2",
  "texts": ["Hello world", "Another text to embed"],
  "normalize": true
}
```

### Model Management
```http
GET /models
POST /models/load
POST /models/unload
DELETE /models/{model_id}
```

## Installation

```bash
cd pytorch-service
pip install -r requirements.txt
python app.py
```

## Docker Support

```bash
docker build -t claudate-pytorch .
docker run -p 8001:8001 --gpus all claudate-pytorch
```

## Configuration

Environment variables:
- `PYTORCH_SERVICE_PORT`: Service port (default: 8001)
- `PYTORCH_MODEL_CACHE_DIR`: Model cache directory
- `PYTORCH_MAX_MODELS`: Maximum models to keep in memory
- `PYTORCH_CUDA_DEVICE`: CUDA device to use