"""
Store Product Sales Efficiency Analysis Tool
Main FastAPI Application
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import pandas as pd
import io
import os
import base64
import json
import re
import requests
from PIL import Image

app = FastAPI(
    title="Store Product Sales Efficiency Analysis Tool",
    description="A web application for visualizing store shelf layouts and analyzing sales efficiency",
    version="1.0.0"
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


class SalesData(BaseModel):
    """Sales data model for processing"""
    category: str
    turnover: float


class CalculateRequest(BaseModel):
    """Request model for efficiency calculation"""
    sales_data: list[SalesData]
    shelf_data: list[dict]


@app.get("/", response_class=HTMLResponse)
async def root():
    """Serve the main HTML page"""
    template_path = os.path.join(os.path.dirname(__file__), "templates", "index.html")
    if os.path.exists(template_path):
        with open(template_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse(content="<h1>Template not found</h1>", status_code=404)


@app.post("/api/import-sales")
async def import_sales_data(file: UploadFile = File(...)):
    """
    Import sales data from Excel or CSV file.
    Returns parsed data with category and turnover columns.
    """
    try:
        # Read file content
        content = await file.read()
        filename = file.filename.lower()
        
        # Parse based on file type
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith(('.xlsx', '.xls')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please use .xlsx, .xls, or .csv files.")
        
        # Clean column names (strip whitespace, handle variations)
        df.columns = df.columns.str.strip()
        
        # Try to identify category and turnover columns
        category_col = None
        turnover_col = None
        
        for col in df.columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in ['category', '类别', '分类', '产品类型', 'product type']):
                category_col = col
                break
        
        for col in df.columns:
            col_lower = col.lower()
            if any(keyword in col_lower for keyword in ['turnover', '营业额', '销售额', 'sales', 'revenue', '营收']):
                turnover_col = col
                break
        
        # If not found, use first two columns
        if category_col is None:
            category_col = df.columns[0]
        if turnover_col is None and len(df.columns) > 1:
            turnover_col = df.columns[1]
        
        if category_col is None or turnover_col is None:
            raise HTTPException(status_code=400, detail="Could not identify category and turnover columns.")
        
        # Extract and clean data
        result_df = df[[category_col, turnover_col]].copy()
        result_df.columns = ['category', 'turnover']
        result_df = result_df.dropna()
        result_df['category'] = result_df['category'].astype(str).str.strip()
        result_df['turnover'] = pd.to_numeric(result_df['turnover'], errors='coerce')
        result_df = result_df.dropna()
        
        # Aggregate by category
        aggregated = result_df.groupby('category')['turnover'].sum().reset_index()
        
        return JSONResponse(content={
            "success": True,
            "data": aggregated.to_dict('records'),
            "columns": {
                "category": category_col,
                "turnover": turnover_col
            },
            "total_records": len(aggregated)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing file: {str(e)}")


@app.post("/api/calculate-efficiency")
async def calculate_efficiency(request: CalculateRequest):
    """
    Calculate sales efficiency for each shelf.
    Efficiency = Turnover / Shelf Length (yuan/meter)
    """
    try:
        # Create a lookup for sales data by category
        sales_lookup = {item.category: item.turnover for item in request.sales_data}
        
        results = []
        
        # Process each shelf
        for shelf in request.shelf_data:
            category = shelf.get('category')
            length = shelf.get('length', 0)  # in meters
            
            if not category or category == 'unassigned':
                results.append({
                    "shelf_id": shelf.get('id'),
                    "category": None,
                    "length": length,
                    "turnover": 0,
                    "efficiency": 0,
                    "status": "unassigned"
                })
            else:
                turnover = sales_lookup.get(category, 0)
                efficiency = round(turnover / length, 2) if length > 0 else 0
                
                results.append({
                    "shelf_id": shelf.get('id'),
                    "category": category,
                    "length": length,
                    "turnover": round(turnover, 2),
                    "efficiency": efficiency,
                    "status": "calculated"
                })
        
        # Calculate aggregated efficiency for same categories
        category_totals = {}
        for shelf in request.shelf_data:
            category = shelf.get('category')
            length = shelf.get('length', 0)
            if category and category != 'unassigned':
                if category not in category_totals:
                    category_totals[category] = {'length': 0, 'turnover': 0}
                category_totals[category]['length'] += length
        
        # Update turnover from sales data
        for category, data in category_totals.items():
            data['turnover'] = sales_lookup.get(category, 0)
            data['efficiency'] = round(data['turnover'] / data['length'], 2) if data['length'] > 0 else 0
        
        return JSONResponse(content={
            "success": True,
            "shelf_results": results,
            "category_summary": category_totals,
            "efficiency_range": {
                "min": min((r['efficiency'] for r in results if r['efficiency'] > 0), default=0),
                "max": max((r['efficiency'] for r in results), default=0)
            }
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error calculating efficiency: {str(e)}")


@app.get("/api/product-categories")
async def get_default_categories():
    """Get default product categories for sports store"""
    categories = [
        {"id": "football", "name": "Football", "color": "#4CAF50"},
        {"id": "basketball", "name": "Basketball", "color": "#FF9800"},
        {"id": "tennis", "name": "Tennis", "color": "#2196F3"},
        {"id": "table_tennis", "name": "Table Tennis", "color": "#9C27B0"},
        {"id": "badminton", "name": "Badminton", "color": "#00BCD4"},
        {"id": "swimming", "name": "Swimming", "color": "#3F51B5"},
        {"id": "running", "name": "Running", "color": "#E91E63"},
        {"id": "yoga", "name": "Yoga", "color": "#795548"},
        {"id": "cycling", "name": "Cycling", "color": "#607D8B"},
        {"id": "fitness", "name": "Fitness", "color": "#FF5722"},
    ]
    return JSONResponse(content={"success": True, "categories": categories})


# ==================== Ollama Integration ====================
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3-vl:2b")

# Image preprocessing settings
IMAGE_MAX_SIZE = 512  # Max width/height for processing (reduced for faster processing)
IMAGE_QUALITY = 75  # JPEG quality for compression


def preprocess_image(image_content: bytes, max_size: int = IMAGE_MAX_SIZE, grayscale: bool = False) -> tuple:
    """
    Preprocess image for faster Ollama processing.
    - Resizes image to max_size x max_size while maintaining aspect ratio
    - Optionally converts to grayscale
    - Returns (base64_image, width, height)
    """
    img = Image.open(io.BytesIO(image_content))

    # Convert to RGB if necessary (handles RGBA, P mode, etc.)
    if img.mode in ('RGBA', 'P'):
        img = img.convert('RGB')

    # Convert to grayscale if requested
    if grayscale:
        img = img.convert('L')
        # Convert back to RGB for compatibility with vision models
        img = img.convert('RGB')

    original_width, original_height = img.size

    # Resize if image is larger than max_size
    if original_width > max_size or original_height > max_size:
        img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)

    new_width, new_height = img.size

    # Save to bytes
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=IMAGE_QUALITY, optimize=True)
    processed_content = output.getvalue()

    # Encode to base64
    base64_image = base64.b64encode(processed_content).decode("utf-8")

    return base64_image, new_width, new_height


def clean_ollama_json_response(raw_text: str) -> dict:
    """
    Extract and validate JSON from Ollama's response.
    Handles various response formats including markdown code blocks.
    """
    # Try to extract JSON from markdown code blocks first
    code_block_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw_text)
    if code_block_match:
        json_str = code_block_match.group(1).strip()
    else:
        # Try to find raw JSON object
        json_match = re.search(r'\{[\s\S]*\}', raw_text)
        if json_match:
            json_str = json_match.group(0)
        else:
            raise ValueError("No valid JSON found in Ollama response")

    try:
        parsed_json = json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON syntax: {str(e)}")

    return parsed_json


def call_ollama_vision(base64_image: str) -> dict:
    """
    Call Ollama's /api/generate endpoint with the image for shelf layout analysis.
    Uses the simpler generate API which works better with vision models.
    """
    prompt = """You are a store shelf layout analysis expert. Analyze the provided store shelf image and extract shelf layout information.

Return ONLY valid JSON (no explanations, no markdown code blocks, no extra text) with the following structure:
{
  "shelves": [
    {
      "id": "shelf-1",
      "type": "horizontal|vertical",
      "x": 0,
      "y": 0,
      "length": 0.5,
      "category": "category_name or null",
      "confidence": 0.0-1.0
    }
  ],
  "imageInfo": {
    "width": 0,
    "height": 0,
    "description": "Brief description of the image"
  }
}

Rules:
1. x, y are pixel coordinates from the top-left corner (0,0) of the image
2. length is in meters (use 0.5m as default unit length)
3. type is either "horizontal" (wider than tall) or "vertical" (taller than wide)
4. category should be the product type visible on the shelf (e.g., "football", "basketball", "tennis", etc.) or null if unclear
5. confidence is a float between 0 and 1 indicating detection confidence
6. Only include actual shelf units, ignore background elements
7. Ensure valid JSON syntax (no trailing commas, proper quotes)"""

    # Use /api/generate endpoint with images field
    payload = {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "images": [base64_image],
        "stream": False
    }

    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/generate",
            json=payload,
            timeout=300  # 5 minutes timeout for image processing
        )
        response.raise_for_status()
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="Cannot connect to Ollama server. Please ensure Ollama is running at " + OLLAMA_BASE_URL
        )
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Ollama request timed out")
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Ollama API error: {str(e)}")

    ollama_response = response.json()
    raw_content = ollama_response.get("response", "")

    if not raw_content:
        raise HTTPException(status_code=500, detail="Ollama returned empty content")

    try:
        cleaned_json = clean_ollama_json_response(raw_content)
    except ValueError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Ollama response: {str(e)}. Raw response: {raw_content[:500]}"
        )

    return cleaned_json


@app.post("/api/analyze-layout-image")
async def analyze_layout_image(file: UploadFile = File(...)):
    """
    Analyze a store shelf layout image using Ollama vision model.
    Extracts shelf positions, orientations, and categories.
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp", "image/jpg"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {file.content_type}. Allowed types: JPEG, PNG, WebP"
        )

    # Read file content
    try:
        file_content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read image: {str(e)}")

    # Preprocess image (resize + optimize)
    try:
        base64_image, img_width, img_height = preprocess_image(file_content, max_size=IMAGE_MAX_SIZE, grayscale=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")

    # Call Ollama
    layout_data = call_ollama_vision(base64_image)

    # Validate and normalize the response
    if "shelves" not in layout_data:
        layout_data["shelves"] = []

    # Ensure each shelf has required fields
    for i, shelf in enumerate(layout_data.get("shelves", [])):
        shelf.setdefault("id", f"shelf-{i+1}")
        shelf.setdefault("type", "horizontal")
        shelf.setdefault("x", 0)
        shelf.setdefault("y", 0)
        shelf.setdefault("length", 0.5)
        shelf.setdefault("category", None)
        shelf.setdefault("confidence", 0.5)

    # Update imageInfo with actual dimensions
    if "imageInfo" not in layout_data:
        layout_data["imageInfo"] = {}
    layout_data["imageInfo"]["width"] = img_width
    layout_data["imageInfo"]["height"] = img_height

    return JSONResponse(content={
        "success": True,
        "data": layout_data,
        "model": OLLAMA_MODEL,
        "processedImageSize": {"width": img_width, "height": img_height}
    })


@app.get("/api/ollama-status")
async def check_ollama_status():
    """Check if Ollama server is running and model is available."""
    try:
        response = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5)
        response.raise_for_status()
        models = response.json().get("models", [])
        model_names = [m.get("name", "") for m in models]

        # Check if qwen vision model is available
        vision_models = [m for m in model_names if "vl" in m.lower() or "vision" in m.lower()]
        has_vision_model = len(vision_models) > 0

        return JSONResponse(content={
            "success": True,
            "ollama_running": True,
            "available_models": model_names,
            "vision_models": vision_models,
            "has_vision_model": has_vision_model,
            "configured_model": OLLAMA_MODEL
        })
    except requests.exceptions.ConnectionError:
        return JSONResponse(
            content={
                "success": False,
                "ollama_running": False,
                "error": "Cannot connect to Ollama server"
            },
            status_code=503
        )
    except Exception as e:
        return JSONResponse(
            content={
                "success": False,
                "error": str(e)
            },
            status_code=500
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)