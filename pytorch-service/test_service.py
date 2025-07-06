#!/usr/bin/env python3
"""
Test script for PyTorch AI service

Run this to test the service functionality:
python test_service.py
"""

import requests
import json
import time
import sys

BASE_URL = "http://localhost:8001"

def test_health():
    """Test health endpoint"""
    print("🔍 Testing health endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Health check passed")
            print(f"   Status: {data['status']}")
            print(f"   PyTorch: {data['pytorch_version']}")
            print(f"   CUDA: {data['cuda_available']}")
            print(f"   Loaded models: {len(data['loaded_models'])}")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_text_generation():
    """Test text generation"""
    print("\n🤖 Testing text generation...")
    try:
        payload = {
            "model": "microsoft/DialoGPT-medium",  # Use a smaller model for testing
            "messages": [
                {"role": "user", "content": "Hello, how are you?"}
            ],
            "max_tokens": 50,
            "temperature": 0.7
        }
        
        print(f"   Model: {payload['model']}")
        print(f"   Prompt: {payload['messages'][0]['content']}")
        
        response = requests.post(f"{BASE_URL}/generate", json=payload, timeout=60)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Text generation successful")
            print(f"   Response: {data['content'][:100]}...")
            print(f"   Tokens: {data['usage']['total_tokens']}")
            return True
        else:
            print(f"❌ Text generation failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Text generation error: {e}")
        return False

def test_embeddings():
    """Test embedding generation"""
    print("\n🔢 Testing embeddings...")
    try:
        payload = {
            "model": "sentence-transformers/all-MiniLM-L6-v2",
            "texts": [
                "Hello world",
                "This is a test sentence",
                "Embeddings are vector representations"
            ],
            "normalize": True
        }
        
        print(f"   Model: {payload['model']}")
        print(f"   Texts: {len(payload['texts'])} sentences")
        
        response = requests.post(f"{BASE_URL}/embeddings", json=payload, timeout=60)
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Embedding generation successful")
            print(f"   Embeddings shape: {len(data['embeddings'])} x {len(data['embeddings'][0])}")
            print(f"   Tokens: {data['usage']['total_tokens']}")
            return True
        else:
            print(f"❌ Embedding generation failed: {response.status_code}")
            print(f"   Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Embedding generation error: {e}")
        return False

def test_model_management():
    """Test model management endpoints"""
    print("\n📊 Testing model management...")
    try:
        # List models
        response = requests.get(f"{BASE_URL}/models")
        if response.status_code == 200:
            models = response.json()
            print(f"✅ Model listing successful")
            print(f"   Loaded models: {len(models)}")
            for model in models:
                print(f"   - {model['model_id']} ({model['model_type']})")
            return True
        else:
            print(f"❌ Model listing failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Model management error: {e}")
        return False

def main():
    """Run all tests"""
    print("🧪 PyTorch AI Service Test Suite")
    print("=" * 40)
    
    # Wait for service to be ready
    print("⏳ Waiting for service to be ready...")
    time.sleep(2)
    
    tests = [
        test_health,
        test_model_management,
        test_embeddings,
        # test_text_generation,  # Comment out for faster testing
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
        time.sleep(1)  # Brief pause between tests
    
    print("\n" + "=" * 40)
    print(f"🎯 Test Results: {passed}/{total} passed")
    
    if passed == total:
        print("🎉 All tests passed! Service is working correctly.")
        sys.exit(0)
    else:
        print("❌ Some tests failed. Check the service configuration.")
        sys.exit(1)

if __name__ == "__main__":
    main()