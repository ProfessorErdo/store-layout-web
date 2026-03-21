# Store Product Sales Efficiency Analysis Tool

A web-based application for visualizing store shelf layouts and analyzing sales efficiency. This tool helps store operations staff optimize shelf display strategies by quantifying the sales performance of different product categories.

![Store Layout Web](https://img.shields.io/badge/version-2.1-blue.svg)
![Python](https://img.shields.io/badge/python-3.12-green.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.121+-orange.svg)

## Features

### Core Features
- **Visual Shelf Layout Builder** - Drag and drop shelf units onto a canvas to create your store layout
- **Product Category Assignment** - Drag categories from sidebar to shelves, or use double-click to configure
- **Sales Data Import** - Import Excel (.xlsx/.xls) or CSV files with sales data
- **Efficiency Calculation** - Calculate sales efficiency (turnover / shelf length)
- **Dual Color Modes** - Switch between Category Mode and Heatmap Mode

### Enhanced Features
- **Shelf Resizing** - Stretch shelves by dragging the edge handle to adjust length
- **Zoom & Pan** - Zoom in/out (25%-300%) and pan the canvas to navigate large layouts
- **Layout Save/Load** - Save layouts as JSON files and restore them later
- **CSV Export** - Export efficiency data with color information for analysis
- **Undo/Redo** - Full history support for all layout changes
- **Remote Access** - Generate public URLs for team collaboration

## Screenshots

### Main Interface
The application provides an intuitive interface with:
- Left sidebar: Shelf units and product categories (draggable)
- Center: Canvas for building layouts (supports zoom & pan)
- Right sidebar: Data import and calculation controls

### Heatmap Mode
Visualize sales efficiency with color gradient:
- 🔴 Red = Low efficiency
- 🟡 Yellow = Medium efficiency
- 🟢 Green = High efficiency

## Quick Start

### Prerequisites
- Python 3.12+
- uv (Python package manager)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/store-layout-web.git
cd store-layout-web
```

2. Install dependencies:
```bash
uv pip install fastapi uvicorn pandas openpyxl python-multipart
```

3. Run the application:
```bash
uv run uvicorn main:app --host 0.0.0.0 --port 8000
```

4. Open your browser and navigate to:
```
http://localhost:8000
```

## Usage Guide

### 1. Build Your Layout
- Drag **Horizontal** or **Vertical** shelf units from the left sidebar onto the canvas
- Position shelves by dragging them to desired locations
- Resize shelves by dragging the edge handle
- Use zoom controls (+/-) to adjust view, drag canvas to pan when zoomed

### 2. Assign Product Categories
- **Drag & Drop**: Drag a category from the left sidebar and drop it onto a shelf
- **Double-Click**: Open the configuration modal to select category and customize color
- Category colors automatically sync across all shelves with the same category

### 3. Import Sales Data
- Click "Import Sales Data" button
- Select an Excel (.xlsx/.xls) or CSV file
- The file should contain "category" and "turnover" columns

### 4. Calculate Efficiency
- Click the "Calculate" button
- View efficiency results in the summary panel
- Switch to "Heatmap" mode to visualize efficiency (Red=Low, Green=High)

### 5. Save & Export
- **Save**: Click "Save" to download layout as JSON (can be reloaded)
- **Load**: Click "Load" to restore a previously saved JSON layout
- **Export CSV**: Click "Export CSV" to download efficiency data with colors

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Delete` | Delete selected shelf |
| `Escape` | Close modal / Deselect |

## Server Management

### Start the Local Server

```bash
cd /path/to/store-layout-web

# Start the server
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Or using uv
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The application will be available at `http://localhost:8000`

### Stop the Local Server

```bash
# Find the running process
ps aux | grep uvicorn | grep -v grep

# Stop all uvicorn processes
pkill -f uvicorn

# Or stop a specific port
lsof -i :8000 | grep LISTEN | awk '{print $2}' | xargs kill
```

### Check Server Status

```bash
# Check if server is running
curl -s http://localhost:8000 > /dev/null && echo "Server is running" || echo "Server is not running"

# Check running processes
ps aux | grep -E "(uvicorn|cloudflared)" | grep -v grep
```

## Remote Access

To share your application with others over the internet:

### Start Cloudflare Tunnel

```bash
# Install cloudflared (macOS)
brew install cloudflared

# Install cloudflared (Linux)
# Download from: https://github.com/cloudflare/cloudflared/releases

# Start the tunnel
cloudflared tunnel --url http://localhost:8000
```

A public URL will be generated (e.g., `https://xxx-xxx-xxx.trycloudflare.com`) that you can share with your team.

### Stop Cloudflare Tunnel

```bash
# Stop all cloudflared processes
pkill -f cloudflared

# Or find and kill specific process
ps aux | grep cloudflared | grep -v grep
kill <PID>
```

### Quick Commands Summary

| Action | Command |
|--------|---------|
| Start server | `uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload` |
| Stop server | `pkill -f uvicorn` |
| Start tunnel | `cloudflared tunnel --url http://localhost:8000` |
| Stop tunnel | `pkill -f cloudflared` |
| Check status | `ps aux \| grep -E "(uvicorn\|cloudflared)" \| grep -v grep` |

## Project Structure

```
store-layout-web/
├── main.py                 # FastAPI application
├── pyproject.toml          # Python dependencies
├── BRD.md                  # Business Requirements Document
├── README.md               # This file
├── templates/
│   └── index.html          # Main HTML template
├── static/
│   ├── css/
│   │   └── styles.css      # Application styles
│   └── js/
│       └── app.js          # Frontend JavaScript
└── sample_sales_data.csv   # Sample data for testing
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve main application page |
| `/api/product-categories` | GET | Get default product categories |
| `/api/import-sales` | POST | Import sales data from Excel/CSV |
| `/api/calculate-efficiency` | POST | Calculate sales efficiency for shelves |

## Sample Data Format

The application accepts Excel or CSV files with the following structure:

| category | turnover |
|----------|----------|
| football | 125000 |
| basketball | 98000 |
| tennis | 45000 |
| ... | ... |

The application will automatically detect columns with keywords like "category", "turnover", "sales", "revenue", etc.

## Default Product Categories

| Category | Color |
|----------|-------|
| Football | 🟢 #4CAF50 |
| Basketball | 🟠 #FF9800 |
| Tennis | 🔵 #2196F3 |
| Table Tennis | 🟣 #9C27B0 |
| Badminton | 🔵 #00BCD4 |
| Swimming | 🔵 #3F51B5 |
| Running | 🔴 #E91E63 |
| Yoga | 🟤 #795548 |
| Cycling | ⚫ #607D8B |
| Fitness | 🟠 #FF5722 |

## Technology Stack

- **Backend**: Python 3.12 + FastAPI
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- **Data Processing**: Pandas
- **Server**: Uvicorn

## Browser Support

- Chrome 80+
- Firefox 75+
- Edge 80+
- Safari 13+

## License

This project is licensed under the MIT License.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Changelog

### v2.1 (March 20, 2026)
- Added drag-and-drop product categories to shelves
- Added canvas panning when zoomed (drag canvas to move)
- Separated Save (JSON) and Export CSV functions
- Added color information to CSV export
- Layout JSON now includes category definitions

### v2.0 (March 20, 2026)
- Added shelf resizing functionality
- Added zoom control for canvas
- Added layout export/load feature
- Added remote access support
- Improved heatmap colors (red-yellow-green gradient)
- Improved shelf label positioning
- Added category color synchronization

### v1.0 (March 20, 2026)
- Initial release
- Core shelf layout builder
- Product category assignment
- Sales data import
- Efficiency calculation
- Dual color modes

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/yourusername/store-layout-web/issues) page.

---

**Developed with ❤️ for store operations teams**