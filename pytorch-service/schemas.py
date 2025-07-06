"""
Pydantic schemas for PyTorch service API
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any, Union
from datetime import datetime

class Message(BaseModel):
    role: str = Field(..., description="Message role: user, assistant, or system")
    content: str = Field(..., description="Message content")

class GenerateRequest(BaseModel):
    model: str = Field(..., description="Model identifier (HuggingFace model name)")
    messages: List[Message] = Field(..., description="Conversation messages")
    max_tokens: int = Field(default=500, description="Maximum tokens to generate")
    temperature: float = Field(default=0.7, description="Sampling temperature")
    top_p: float = Field(default=0.9, description="Top-p sampling parameter")
    stream: bool = Field(default=False, description="Stream response")

class GenerateResponse(BaseModel):
    content: str = Field(..., description="Generated text content")
    model: str = Field(..., description="Model used for generation")
    finish_reason: str = Field(..., description="Reason generation stopped")
    usage: Dict[str, int] = Field(..., description="Token usage information")

class EmbeddingRequest(BaseModel):
    model: str = Field(..., description="Embedding model identifier")
    texts: List[str] = Field(..., description="Texts to embed")
    normalize: bool = Field(default=True, description="Normalize embeddings")

class EmbeddingResponse(BaseModel):
    embeddings: List[List[float]] = Field(..., description="Generated embeddings")
    model: str = Field(..., description="Model used for embeddings")
    usage: Dict[str, int] = Field(..., description="Token usage information")

class HealthResponse(BaseModel):
    status: str = Field(..., description="Service health status")
    timestamp: datetime = Field(..., description="Health check timestamp")
    pytorch_version: str = Field(..., description="PyTorch version")
    cuda_available: bool = Field(..., description="CUDA availability")
    loaded_models: List[str] = Field(..., description="Currently loaded models")

class ModelInfo(BaseModel):
    model_id: str = Field(..., description="Model identifier")
    model_type: str = Field(..., description="Model type (text-generation, embedding, etc.)")
    loaded: bool = Field(..., description="Whether model is currently loaded")
    memory_usage: Optional[float] = Field(None, description="Memory usage in MB")
    last_used: Optional[datetime] = Field(None, description="Last usage timestamp")

class LoadModelRequest(BaseModel):
    model_id: str = Field(..., description="Model identifier to load")
    model_type: str = Field(default="text-generation", description="Type of model")
    force_reload: bool = Field(default=False, description="Force reload if already loaded")