"""
PyTorch AI Microservice

Provides PyTorch and Hugging Face model inference capabilities
for the Claudate AI framework.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import torch
import logging
import os
from datetime import datetime

from model_manager import ModelManager
from schemas import (
    GenerateRequest, 
    GenerateResponse, 
    EmbeddingRequest, 
    EmbeddingResponse,
    HealthResponse,
    ModelInfo
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(
    title="Claudate PyTorch Service",
    description="PyTorch and Hugging Face model inference service",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model manager
model_manager = ModelManager()

@app.on_event("startup")
async def startup_event():
    """Initialize service on startup"""
    logger.info("Starting Claudate PyTorch Service...")
    logger.info(f"PyTorch version: {torch.__version__}")
    logger.info(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"CUDA device count: {torch.cuda.device_count()}")
        logger.info(f"Current CUDA device: {torch.cuda.current_device()}")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down Claudate PyTorch Service...")
    await model_manager.cleanup()

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow(),
        pytorch_version=torch.__version__,
        cuda_available=torch.cuda.is_available(),
        loaded_models=list(model_manager.loaded_models.keys())
    )

@app.post("/generate", response_model=GenerateResponse)
async def generate_text(request: GenerateRequest):
    """Generate text using a loaded model"""
    try:
        logger.info(f"Text generation request for model: {request.model}")
        
        # Load model if not already loaded
        model, tokenizer = await model_manager.load_model(
            request.model, 
            model_type="text-generation"
        )
        
        # Generate text
        result = await model_manager.generate_text(
            model=model,
            tokenizer=tokenizer,
            messages=request.messages,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p
        )
        
        return GenerateResponse(
            content=result["content"],
            model=request.model,
            finish_reason=result.get("finish_reason", "stop"),
            usage={
                "input_tokens": result.get("input_tokens", 0),
                "output_tokens": result.get("output_tokens", 0),
                "total_tokens": result.get("total_tokens", 0)
            }
        )
        
    except Exception as e:
        logger.error(f"Text generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/embeddings", response_model=EmbeddingResponse)
async def generate_embeddings(request: EmbeddingRequest):
    """Generate embeddings for input texts"""
    try:
        logger.info(f"Embedding request for model: {request.model}")
        
        # Load model if not already loaded
        model, tokenizer = await model_manager.load_model(
            request.model, 
            model_type="embedding"
        )
        
        # Generate embeddings
        result = await model_manager.generate_embeddings(
            model=model,
            tokenizer=tokenizer,
            texts=request.texts,
            normalize=request.normalize
        )
        
        return EmbeddingResponse(
            embeddings=result["embeddings"],
            model=request.model,
            usage={
                "input_tokens": result.get("input_tokens", 0),
                "total_tokens": result.get("total_tokens", 0)
            }
        )
        
    except Exception as e:
        logger.error(f"Embedding generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/models", response_model=List[ModelInfo])
async def list_models():
    """List available and loaded models"""
    return model_manager.get_model_info()

@app.post("/models/load")
async def load_model(model_id: str, model_type: str = "text-generation"):
    """Preload a model into memory"""
    try:
        await model_manager.load_model(model_id, model_type)
        return {"status": "success", "model": model_id, "type": model_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/models/unload")
async def unload_model(model_id: str):
    """Unload a model from memory"""
    try:
        model_manager.unload_model(model_id)
        return {"status": "success", "model": model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/models/{model_id}")
async def delete_model(model_id: str):
    """Delete a model from cache"""
    try:
        model_manager.delete_model_cache(model_id)
        return {"status": "success", "model": model_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PYTORCH_SERVICE_PORT", 8001))
    uvicorn.run(
        "app:app", 
        host="0.0.0.0", 
        port=port, 
        reload=True,
        log_level="info"
    )