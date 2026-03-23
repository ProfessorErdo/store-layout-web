# Step-by-Step Implementation Guide: Integrate Ollama (qwen-vl) with Store Layout Web App
## Document Overview
This guide provides a **text-only, detailed step-by-step implementation** to integrate a local Ollama instance (with qwen-vl model) into your existing store layout web application (running at `http://localhost:8000`). The goal is to enable image-to-layout conversion by extracting store layout elements from uploaded images via qwen-vl, then rendering them in your drag-and-drop interface.  

**Key Update**: Replaced Nginx proxy with a FastAPI backend to bypass CORS (more developer-friendly for Python/web stacks and easier to integrate with your app’s backend logic).

---

## Prerequisites Confirmation
Before starting, verify these prerequisites are met:
1. Ollama is installed locally, with the `qwen-vl` model pulled and functional (tested via Ollama GUI).
2. Your web app runs at `http://localhost:8000` and has a working drag-and-drop layout builder.
3. Python 3.8+ is installed (for FastAPI backend).
4. Basic web development tools (terminal, code editor, browser) are available.

---

## Step 1: Start and Verify Ollama Server
### 1.1 Launch Ollama Server
Open a terminal window and run the following command to start the Ollama server (runs in background):
```bash
ollama serve
```
Keep this terminal window open (or run it in the background with `nohup ollama serve &`).

### 1.2 Verify qwen-vl Model Availability
In a **new terminal window**, run:
```bash
ollama list
```
Confirm the output includes `qwen-vl` (e.g., `qwen-vl:latest`). If not, pull the model first:
```bash
ollama pull qwen-vl
```

### 1.3 Test Ollama API Connectivity
Test the Ollama API endpoint (to ensure it’s reachable) by running:
```bash
curl http://localhost:11434/api/tags
```
You should receive a JSON response listing available models (including `qwen-vl`).

---

## Step 2: Set Up FastAPI Backend (CORS Bypass + Ollama Proxy)
We’ll create a lightweight FastAPI backend to:
- Act as a proxy between your web app (`localhost:8000`) and Ollama (`localhost:11434`)
- Handle CORS natively (no need for Nginx)
- Validate requests and simplify image processing

### 2.1 Install FastAPI Dependencies
In a terminal, run:
```bash
# Install FastAPI and required packages
pip install fastapi uvicorn requests python-multipart python-dotenv
```

### 2.2 Create FastAPI Backend Code
Create a new folder for your backend (e.g., `ollama-proxy-backend`) and add a file named `main.py` with the following content:
```python
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import requests
import base64
import json
import re

# Initialize FastAPI app
app = FastAPI(title="Ollama Store Layout Proxy", version="1.0")

# Configure CORS (allow your web app at localhost:8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],  # Explicitly allow your web app
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods (GET, POST, OPTIONS)
    allow_headers=["*"],  # Allow all headers
)

# Ollama configuration
OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_MODEL = "qwen-vl"

# --------------------------
# Helper Functions
# --------------------------
def clean_ollama_json_response(raw_text: str) -> dict:
    """
    Extract and validate JSON from Ollama's response (removes extra text)
    """
    # Extract JSON block from any surrounding text
    json_match = re.search(r'\{[\s\S]*\}', raw_text)
    if not json_match:
        raise ValueError("No valid JSON found in Ollama response")
    
    # Parse JSON
    try:
        parsed_json = json.loads(json_match.group(0))
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON syntax: {str(e)}")
    
    # Validate required structure
    required_keys = ["elements", "imageDimensions"]
    if not all(key in parsed_json for key in required_keys):
        raise ValueError(f"Missing required keys: {', '.join(required_keys)}")
    
    if not isinstance(parsed_json["elements"], list):
        raise ValueError("'elements' must be a list")
    
    return parsed_json

def call_ollama_chat(base64_image: str) -> dict:
    """
    Call Ollama's /api/chat endpoint with the image and prompt
    """
    # Ollama API payload
    payload = {
        "model": OLLAMA_MODEL,
        "stream": False,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "image": base64_image
                    },
                    {
                        "type": "text",
                        "text": """You are a store layout analysis expert. Analyze the provided store layout image and return ONLY valid JSON (no explanations, no extra text) with the following strict structure:
{
  "elements": [
    {
      "id": "element-1",
      "type": "shelf|cashier|aisle|display|wall|entrance|exit",
      "x": 0,
      "y": 0,
      "width": 0,
      "height": 0,
      "label": "Human-readable label for the element"
    }
  ],
  "imageDimensions": {
    "width": 0,
    "height": 0
  }
}
Rules:
1. Use the top-left corner of the image as the origin (0,0) for x/y coordinates.
2. All coordinates (x/y/width/height) must be integers (pixels relative to the image).
3. Only include store layout elements (ignore text, watermarks, or background clutter).
4. Ensure the JSON is valid (no trailing commas, correct syntax).
5. Assign unique IDs to each element (e.g., "shelf-1", "cashier-1")."""
                    }
                ]
            }
        ]
    }

    # Send request to Ollama
    try:
        response = requests.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=payload,
            timeout=60  # Longer timeout for image processing
        )
        response.raise_for_status()  # Raise error for HTTP status codes >=400
    except requests.exceptions.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Ollama API error: {str(e)}")
    
    # Parse response
    ollama_response = response.json()
    raw_content = ollama_response.get("message", {}).get("content", "")
    if not raw_content:
        raise HTTPException(status_code=500, detail="Ollama returned empty content")
    
    # Clean and validate JSON
    try:
        cleaned_json = clean_ollama_json_response(raw_content)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=f"Invalid Ollama response: {str(e)}")
    
    return cleaned_json

# --------------------------
# API Endpoints
# --------------------------
@app.post("/api/analyze-store-layout")
async def analyze_store_layout(file: UploadFile = File(...)):
    """
    Main endpoint: Accept image upload, proxy to Ollama, return structured layout data
    """
    # Validate file type
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed types: {', '.join(allowed_types)}"
        )
    
    # Read file and convert to Base64
    try:
        file_content = await file.read()
        base64_image = base64.b64encode(file_content).decode("utf-8")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to process image: {str(e)}")
    
    # Call Ollama and return cleaned data
    layout_data = call_ollama_chat(base64_image)
    return JSONResponse(content=layout_data)

# Health check endpoint (for testing)
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "ollama_model": OLLAMA_MODEL}
```

### 2.3 Run the FastAPI Backend
In the terminal, navigate to the `ollama-proxy-backend` folder and run:
```bash
# Run FastAPI with auto-reload (development mode)
uvicorn main:app --host 0.0.0.0 --port 8081 --reload
```
- The backend will run at `http://localhost:8081`
- Verify it’s working: Visit `http://localhost:8081/api/health` in your browser (should return `{"status":"healthy", ...}`)

---

## Step 3: Update Web App to Use FastAPI Backend
Modify your web app code to call the FastAPI endpoint (instead of directly calling Ollama) — this eliminates CORS issues and simplifies image handling (no need for manual Base64 conversion in the frontend).

### 3.1 Update HTML Elements (No Changes Needed)
Keep the same HTML from the original guide (image upload + analyze button + layout container):
```html
<!-- Image Upload Section -->
<div id="image-upload-section">
    <input type="file" id="store-layout-image" accept="image/*" />
    <button id="analyze-image-btn">Analyze Layout from Image</button>
    <div id="error-message" style="color: red; display: none;"></div>
</div>

<!-- Existing Store Layout Container (your drag-and-drop canvas) -->
<div id="store-layout-container" style="position: relative; width: 1200px; height: 800px; border: 1px solid #ccc;"></div>
```

### 3.2 Updated JavaScript Logic (FastAPI Integration)
Replace the frontend JavaScript with this version (simpler, as FastAPI handles Base64 and Ollama calls):
```javascript
// --------------------------
// Core Helpers
// --------------------------
/**
 * Validate layout data structure (ensure it matches expected format)
 * @param {object} data - Parsed JSON from FastAPI
 * @returns {boolean} True if valid, false otherwise
 */
function validateLayoutData(data) {
    if (!data || typeof data !== 'object') return false;
    if (!Array.isArray(data.elements)) return false;
    if (!data.imageDimensions || typeof data.imageDimensions.width !== 'number' || typeof data.imageDimensions.height !== 'number') return false;
    
    // Validate each element
    for (const element of data.elements) {
        const requiredFields = ['id', 'type', 'x', 'y', 'width', 'height', 'label'];
        if (!requiredFields.every(field => element.hasOwnProperty(field))) return false;
        if (typeof element.x !== 'number' || typeof element.y !== 'number') return false;
    }
    return true;
}

// --------------------------
// FastAPI Integration
// --------------------------
/**
 * Upload image to FastAPI backend for layout analysis
 * @returns {Promise<object|null>} Structured layout data or null on error
 */
async function analyzeLayoutWithFastAPI() {
    const errorElement = document.getElementById('error-message');
    errorElement.style.display = 'none';
    errorElement.textContent = '';

    // Get uploaded file
    const imageInput = document.getElementById('store-layout-image');
    const file = imageInput.files[0];
    if (!file) {
        errorElement.style.display = 'block';
        errorElement.textContent = 'Please upload a store layout image first (JPG/PNG)';
        return null;
    }

    // Create FormData (handles file upload natively)
    const formData = new FormData();
    formData.append('file', file);

    try {
        // Call FastAPI endpoint (no CORS issues!)
        const response = await fetch('http://localhost:8081/api/analyze-store-layout', {
            method: 'POST',
            body: formData, // FastAPI handles file parsing
        });

        // Handle HTTP errors
        if (!response.ok) {
            const errorDetails = await response.json();
            throw new Error(errorDetails.detail || `HTTP Error: ${response.status}`);
        }

        // Parse response (FastAPI returns clean JSON)
        const layoutData = await response.json();

        // Validate layout data
        if (!validateLayoutData(layoutData)) {
            throw new Error('Invalid layout data structure from backend');
        }

        return layoutData;

    } catch (error) {
        console.error('Analysis Error:', error);
        errorElement.style.display = 'block';
        errorElement.textContent = `Analysis Failed: ${error.message}`;
        return null;
    }
}

// --------------------------
// Render Layout Elements (Integrate with Your Drag-and-Drop System)
// --------------------------
/**
 * Render extracted layout elements into your existing drag-and-drop container
 * @param {object} layoutData - Validated layout data from FastAPI
 */
function renderLayoutElements(layoutData) {
    const container = document.getElementById('store-layout-container');
    // Clear existing elements (optional—adjust if you want to keep existing layout)
    container.innerHTML = '';

    // Calculate scale factor to fit image coordinates to your container
    const containerWidth = container.offsetWidth;
    const containerHeight = container.offsetHeight;
    const imageWidth = layoutData.imageDimensions.width;
    const imageHeight = layoutData.imageDimensions.height;
    const scaleX = containerWidth / imageWidth;
    const scaleY = containerHeight / imageHeight;
    const scaleFactor = Math.min(scaleX, scaleY); // Maintain aspect ratio

    // Create and add each layout element to the container
    layoutData.elements.forEach((element, index) => {
        // Create element block (match your existing drag-and-drop block style)
        const block = document.createElement('div');
        block.id = element.id || `element-${index}`;
        block.className = `layout-block ${element.type}`; // Reuse your existing CSS classes
        block.dataset.type = element.type;
        block.dataset.label = element.label;

        // Position and size (scaled to container)
        block.style.position = 'absolute';
        block.style.left = `${element.x * scaleFactor}px`;
        block.style.top = `${element.y * scaleFactor}px`;
        block.style.width = `${element.width * scaleFactor}px`;
        block.style.height = `${element.height * scaleFactor}px`;
        block.style.backgroundColor = getElementColor(element.type); // Use your existing color scheme
        block.style.border = '1px solid #333';
        block.style.padding = '4px';
        block.style.boxSizing = 'border-box';
        block.textContent = element.label;

        // Make block draggable (REPLACE THIS WITH YOUR EXISTING DRAG-AND-DROP LOGIC)
        makeBlockDraggable(block);

        // Add to container
        container.appendChild(block);
    });
}

/**
 * Helper: Assign colors to element types (match your existing style)
 * @param {string} type - Element type (shelf/cashier/etc.)
 * @returns {string} CSS color value
 */
function getElementColor(type) {
    const colorMap = {
        shelf: '#e1f5fe',
        cashier: '#ffe0b2',
        aisle: '#f3e5f5',
        display: '#c8e6c9',
        wall: '#fafafa',
        entrance: '#ffcdd2',
        exit: '#b3e5fc'
    };
    return colorMap[type] || '#ffffff';
}

/**
 * Replace this with your existing drag-and-drop implementation
 * @param {HTMLElement} block - Layout element block
 */
function makeBlockDraggable(block) {
    // Example minimal drag logic (replace with your code)
    block.draggable = true;
    block.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', block.id);
        block.style.opacity = '0.5';
    });
    block.addEventListener('dragend', () => {
        block.style.opacity = '1';
    });

    // Add drop logic to your container (if not already present)
    const container = document.getElementById('store-layout-container');
    container.addEventListener('dragover', (e) => e.preventDefault());
    container.addEventListener('drop', (e) => {
        e.preventDefault();
        const blockId = e.dataTransfer.getData('text/plain');
        const draggedBlock = document.getElementById(blockId);
        if (draggedBlock) {
            // Position block at drop location (adjust for container offset)
            const x = e.clientX - container.getBoundingClientRect().left - (draggedBlock.offsetWidth / 2);
            const y = e.clientY - container.getBoundingClientRect().top - (draggedBlock.offsetHeight / 2);
            draggedBlock.style.left = `${Math.max(0, x)}px`;
            draggedBlock.style.top = `${Math.max(0, y)}px`;
        }
    });
}

// --------------------------
// Event Listeners (Connect UI to Logic)
// --------------------------
document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyze-image-btn');

    // Analyze button click handler
    analyzeBtn.addEventListener('click', async () => {
        // Step 1: Call FastAPI backend for analysis
        const layoutData = await analyzeLayoutWithFastAPI();
        if (!layoutData) return;

        // Step 2: Render elements in drag-and-drop container
        renderLayoutElements(layoutData);

        // Optional: Show success message
        alert('Layout analyzed successfully! Elements are now draggable.');
    });
});
```

### 3.3 Adapt to Your Existing App
Modify these parts to match your web app’s structure:
1. **CSS Classes**: Replace `layout-block` and type-specific classes (e.g., `.shelf`) with your existing CSS classes.
2. **Drag-and-Drop Logic**: Replace `makeBlockDraggable` with your existing drag-and-drop code (React DnD, Vue Draggable, interact.js, etc.).
3. **Container Dimensions**: Adjust `store-layout-container` dimensions to match your app’s canvas.
4. **Error Handling**: Integrate error messages with your app’s notification system (toasts, modals, etc.).
5. **File Types**: Update allowed file types in FastAPI (`allowed_types` in `main.py`) if needed (e.g., add `image/svg+xml` for blueprints).

---

## Step 4: Test the Integration End-to-End
### 4.1 Start All Services (Order Matters)
1. **Ollama Server**: Ensure `ollama serve` is running (terminal 1).
2. **FastAPI Backend**: Run `uvicorn main:app --host 0.0.0.0 --port 8081 --reload` (terminal 2).
3. **Your Web App**: Start it (ensure it runs at `http://localhost:8000` — terminal 3).

### 4.2 Test Workflow
1. Open `http://localhost:8000` in your browser.
2. Click the file input and upload a clear store layout image (blueprint/sketch/photo).
3. Click "Analyze Layout from Image".
4. Verify:
   - No CORS errors in the browser’s developer console (F12 → Console tab).
   - The FastAPI backend logs show the request (terminal 2).
   - Ollama processes the image (may take 5-10 seconds for large files).
   - Layout elements (shelves/cashiers/etc.) appear in your drag-and-drop container.
   - Elements are draggable (using your existing logic).

### 4.3 Troubleshooting Common Issues
| Issue | Solution |
|-------|----------|
| FastAPI returns "Ollama API error" | Confirm Ollama server is running at `localhost:11434` (test with `curl http://localhost:11434/api/tags`). |
| "Invalid JSON" error from FastAPI | Refine the prompt in FastAPI’s `main.py` (make it more explicit about strict JSON output). |
| Elements are mispositioned | Adjust the `scaleFactor` calculation in the frontend `renderLayoutElements` function. |
| File upload fails | Check FastAPI’s `allowed_types` (add your image type if missing, e.g., `image/gif`). |
| FastAPI port 8081 is in use | Change the port in the FastAPI run command (e.g., `--port 8082`) and update the frontend fetch URL. |

---

## Step 5: Optimize and Extend (Optional)
### 5.1 Improve FastAPI Performance
- Add image resizing to the FastAPI backend (reduce large image sizes before sending to Ollama):
  ```python
  # Add to main.py (install Pillow first: pip install pillow)
  from PIL import Image
  import io

  def resize_image(image_content: bytes, max_size: int = 1024) -> bytes:
      """Resize image to max width/height of max_size (maintain aspect ratio)"""
      img = Image.open(io.BytesIO(image_content))
      img.thumbnail((max_size, max_size))
      output = io.BytesIO()
      img.save(output, format=img.format)
      return output.getvalue()

  # Update analyze_store_layout endpoint to use resize_image:
  file_content = await file.read()
  file_content = resize_image(file_content)  # Add this line
  base64_image = base64.b64encode(file_content).decode("utf-8")
  ```
- Add request caching (e.g., `fastapi-cache2` with Redis) to avoid re-analyzing the same image.

### 5.2 Enhance Prompt Engineering
Update the prompt in FastAPI’s `main.py` to improve accuracy:
- Specify "use metric units if the image is a blueprint" or "ignore shadows/lighting in photos".
- Add examples (e.g., `"x": 150 means 150 pixels from the left edge of the image`).
- Request additional attributes (e.g., `"orientation": "vertical|horizontal"` for shelves).

### 5.3 Add Authentication (Production)
Add API key authentication to FastAPI to prevent unauthorized access:
```python
# Add to main.py
API_KEY = "your-secret-api-key"  # Store in .env in production

@app.post("/api/analyze-store-layout")
async def analyze_store_layout(file: UploadFile = File(...), request: Request = None):
    # Check API key
    api_key = request.headers.get("X-API-Key")
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Rest of the endpoint logic...
```
Then update the frontend fetch call to include the API key:
```javascript
const response = await fetch('http://localhost:8081/api/analyze-store-layout', {
    method: 'POST',
    headers: {
        'X-API-Key': 'your-secret-api-key'  // Match FastAPI's API_KEY
    },
    body: formData,
});
```

---

## Step 6: Production Considerations
When moving to production:
1. **FastAPI Deployment**: Use Gunicorn + Uvicorn (instead of `uvicorn --reload`) for production:
   ```bash
   gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8081
   ```
2. **CORS Restrictions**: Narrow down `allow_origins` in FastAPI to your production domain (e.g., `["https://your-app.com"]` instead of `localhost:8000`).
3. **Ollama Deployment**: Run Ollama as a background service (e.g., systemd on Linux, launchd on macOS).
4. **Error Logging**: Add structured logging to FastAPI (e.g., `logging` module) for debugging.
5. **File Limits**: Add file size limits to FastAPI (e.g., `max_length=10_000_000` for 10MB files):
   ```python
   @app.post("/api/analyze-store-layout")
   async def analyze_store_layout(file: UploadFile = File(..., max_length=10_000_000)):
   ```

---

### Summary
1. **Backend Setup**: Create a FastAPI backend to proxy Ollama requests, handle CORS (allowing `localhost:8000`), and process image uploads — this eliminates the need for Nginx.
2. **Frontend Integration**: Update your web app to call the FastAPI endpoint (instead of direct Ollama calls) — simpler code (no manual Base64 conversion) and no CORS errors.
3. **Testing & Optimization**: Validate the end-to-end workflow, fix common issues (JSON parsing, scaling), and optimize with image resizing/prompt refinement for better accuracy.

This FastAPI-based approach is more maintainable than Nginx (especially if your app uses Python) and provides better control over request validation, error handling, and future extensions (e.g., authentication, caching).