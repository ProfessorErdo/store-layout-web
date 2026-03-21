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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)