"""
Model management for PyTorch service

Handles loading, caching, and inference for Hugging Face models.
"""

import torch
from transformers import (
    AutoTokenizer, 
    AutoModel, 
    AutoModelForCausalLM,
    AutoModelForSeq2SeqLM,
    pipeline
)
from sentence_transformers import SentenceTransformer
import asyncio
import logging
import os
import psutil
from typing import Dict, List, Tuple, Any, Optional
from datetime import datetime
import json
import gc

logger = logging.getLogger(__name__)

class ModelManager:
    def __init__(self):
        self.loaded_models: Dict[str, Dict[str, Any]] = {}
        self.model_cache_dir = os.getenv("PYTORCH_MODEL_CACHE_DIR", "./model_cache")
        self.max_models = int(os.getenv("PYTORCH_MAX_MODELS", "3"))
        self.device = self._get_device()
        
        # Ensure cache directory exists
        os.makedirs(self.model_cache_dir, exist_ok=True)
        
        logger.info(f"ModelManager initialized with device: {self.device}")
        logger.info(f"Model cache directory: {self.model_cache_dir}")
        logger.info(f"Max models in memory: {self.max_models}")

    def _get_device(self) -> str:
        """Determine the best device to use"""
        if torch.cuda.is_available():
            device_id = os.getenv("PYTORCH_CUDA_DEVICE", "0")
            return f"cuda:{device_id}"
        elif torch.backends.mps.is_available():  # Apple Silicon
            return "mps"
        else:
            return "cpu"

    async def load_model(self, model_id: str, model_type: str = "text-generation") -> Tuple[Any, Any]:
        """Load a model and tokenizer"""
        cache_key = f"{model_id}:{model_type}"
        
        # Check if model is already loaded
        if cache_key in self.loaded_models:
            logger.info(f"Model {model_id} already loaded")
            self.loaded_models[cache_key]["last_used"] = datetime.utcnow()
            return (
                self.loaded_models[cache_key]["model"],
                self.loaded_models[cache_key]["tokenizer"]
            )
        
        # Check memory limits
        if len(self.loaded_models) >= self.max_models:
            await self._evict_oldest_model()
        
        logger.info(f"Loading model: {model_id} (type: {model_type})")
        
        try:
            if model_type == "embedding":
                model, tokenizer = await self._load_embedding_model(model_id)
            elif model_type == "text-generation":
                model, tokenizer = await self._load_generation_model(model_id)
            else:
                raise ValueError(f"Unsupported model type: {model_type}")
            
            # Cache the loaded model
            self.loaded_models[cache_key] = {
                "model": model,
                "tokenizer": tokenizer,
                "model_type": model_type,
                "loaded_at": datetime.utcnow(),
                "last_used": datetime.utcnow(),
                "memory_usage": self._get_model_memory_usage()
            }
            
            logger.info(f"Successfully loaded model: {model_id}")
            return model, tokenizer
            
        except Exception as e:
            logger.error(f"Failed to load model {model_id}: {str(e)}")
            raise

    async def _load_embedding_model(self, model_id: str) -> Tuple[Any, Any]:
        """Load an embedding model"""
        # Try sentence-transformers first (optimized for embeddings)
        try:
            model = SentenceTransformer(model_id, cache_folder=self.model_cache_dir)
            if hasattr(model, 'to'):
                model = model.to(self.device)
            return model, None  # SentenceTransformer handles tokenization internally
        except:
            # Fallback to transformers
            tokenizer = AutoTokenizer.from_pretrained(
                model_id, 
                cache_dir=self.model_cache_dir
            )
            model = AutoModel.from_pretrained(
                model_id, 
                cache_dir=self.model_cache_dir
            ).to(self.device)
            return model, tokenizer

    async def _load_generation_model(self, model_id: str) -> Tuple[Any, Any]:
        """Load a text generation model"""
        tokenizer = AutoTokenizer.from_pretrained(
            model_id, 
            cache_dir=self.model_cache_dir
        )
        
        # Add padding token if not present
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        try:
            # Try causal LM first (most common for generation)
            model = AutoModelForCausalLM.from_pretrained(
                model_id, 
                cache_dir=self.model_cache_dir,
                torch_dtype=torch.float16 if self.device.startswith('cuda') else torch.float32,
                device_map="auto" if self.device.startswith('cuda') else None
            )
        except:
            try:
                # Fallback to seq2seq
                model = AutoModelForSeq2SeqLM.from_pretrained(
                    model_id, 
                    cache_dir=self.model_cache_dir
                ).to(self.device)
            except:
                # Generic model fallback
                model = AutoModel.from_pretrained(
                    model_id, 
                    cache_dir=self.model_cache_dir
                ).to(self.device)
        
        return model, tokenizer

    async def generate_text(
        self, 
        model: Any, 
        tokenizer: Any, 
        messages: List[Dict[str, str]], 
        max_tokens: int = 500,
        temperature: float = 0.7,
        top_p: float = 0.9
    ) -> Dict[str, Any]:
        """Generate text using the loaded model"""
        
        # Format messages into a single prompt
        prompt = self._format_messages(messages)
        
        # Tokenize input
        inputs = tokenizer(
            prompt, 
            return_tensors="pt", 
            truncation=True, 
            max_length=2048
        ).to(self.device)
        
        input_tokens = inputs['input_ids'].shape[1]
        
        # Generate
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
        
        # Decode response
        response = tokenizer.decode(
            outputs[0][input_tokens:], 
            skip_special_tokens=True
        )
        
        output_tokens = outputs[0].shape[0] - input_tokens
        
        return {
            "content": response.strip(),
            "finish_reason": "stop",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens
        }

    async def generate_embeddings(
        self, 
        model: Any, 
        tokenizer: Any, 
        texts: List[str], 
        normalize: bool = True
    ) -> Dict[str, Any]:
        """Generate embeddings for input texts"""
        
        if isinstance(model, SentenceTransformer):
            # Use sentence-transformers (optimized)
            embeddings = model.encode(
                texts, 
                normalize_embeddings=normalize,
                convert_to_tensor=True
            ).cpu().numpy().tolist()
            
            # Estimate token usage
            total_tokens = sum(len(text.split()) for text in texts)
            
        else:
            # Use transformers model
            embeddings = []
            total_tokens = 0
            
            for text in texts:
                inputs = tokenizer(
                    text, 
                    return_tensors="pt", 
                    truncation=True, 
                    max_length=512,
                    padding=True
                ).to(self.device)
                
                total_tokens += inputs['input_ids'].shape[1]
                
                with torch.no_grad():
                    outputs = model(**inputs)
                    # Use mean pooling of last hidden state
                    embedding = outputs.last_hidden_state.mean(dim=1).squeeze()
                    
                    if normalize:
                        embedding = torch.nn.functional.normalize(embedding, p=2, dim=0)
                    
                    embeddings.append(embedding.cpu().numpy().tolist())
        
        return {
            "embeddings": embeddings,
            "input_tokens": total_tokens,
            "total_tokens": total_tokens
        }

    def _format_messages(self, messages: List[Dict[str, str]]) -> str:
        """Format conversation messages into a prompt"""
        formatted = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                formatted.append(f"System: {content}")
            elif role == "user":
                formatted.append(f"User: {content}")
            elif role == "assistant":
                formatted.append(f"Assistant: {content}")
        
        formatted.append("Assistant:")
        return "\n".join(formatted)

    async def _evict_oldest_model(self):
        """Remove the oldest model from memory"""
        if not self.loaded_models:
            return
        
        oldest_key = min(
            self.loaded_models.keys(),
            key=lambda k: self.loaded_models[k]["last_used"]
        )
        
        logger.info(f"Evicting model: {oldest_key}")
        self.unload_model(oldest_key)

    def unload_model(self, cache_key: str):
        """Unload a specific model from memory"""
        if cache_key in self.loaded_models:
            logger.info(f"Unloading model: {cache_key}")
            
            # Clean up GPU memory
            if hasattr(self.loaded_models[cache_key]["model"], 'cpu'):
                self.loaded_models[cache_key]["model"].cpu()
            
            del self.loaded_models[cache_key]
            
            # Force garbage collection
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    def get_model_info(self) -> List[Dict[str, Any]]:
        """Get information about loaded models"""
        info = []
        for cache_key, model_data in self.loaded_models.items():
            model_id, model_type = cache_key.split(":", 1)
            info.append({
                "model_id": model_id,
                "model_type": model_type,
                "loaded": True,
                "memory_usage": model_data.get("memory_usage", 0),
                "last_used": model_data["last_used"]
            })
        return info

    def _get_model_memory_usage(self) -> float:
        """Get current memory usage in MB"""
        process = psutil.Process()
        return process.memory_info().rss / 1024 / 1024

    def delete_model_cache(self, model_id: str):
        """Delete cached model files"""
        # This would implement deletion of cached model files
        # Implementation depends on how HuggingFace cache is organized
        logger.info(f"Cache deletion requested for model: {model_id}")
        # TODO: Implement actual cache deletion

    async def cleanup(self):
        """Cleanup all loaded models"""
        logger.info("Cleaning up all loaded models...")
        for cache_key in list(self.loaded_models.keys()):
            self.unload_model(cache_key)