# Store Product Sales Efficiency Analysis Tool - Business Requirements Document (BRD)
## Document Information
| Item         | Content                                   |
|--------------|-------------------------------------------|
| Version      | V2.1                                      |
| Document Type| Business Requirements Document (BRD)      |
| Project Name | Store Product Sales Efficiency Analysis Tool |
| Date         | March 20, 2026                            |
| Last Updated | March 20, 2026                            |
| Target Audience | Product, R&D, Testing, Business Teams |

## 1. Project Overview
### 1.1 Project Background
Store shelf space is a core operational asset. Currently, there is a lack of intuitive and efficient tools to analyze the sales efficiency of different product categories on shelves, making it impossible to accurately guide shelf layout optimization and product display strategy adjustment, resulting in underutilized shelf resources.

### 1.2 Project Objective
Develop a web-based front-end application that visualizes store shelf layouts, automatically calculates and displays sales efficiency for each shelf/category based on product sales data, and assists store operations staff in analyzing product sales efficiency to optimize shelf display strategies.

### 1.3 Core Definitions
| Term                  | Definition                                              |
|-----------------------|---------------------------------------------------------|
| Product Sales Efficiency | Turnover / Shelf Length (Unit: yuan/meter) |
| Product Category      | Classified by sport type (e.g., football, basketball, table tennis, etc.) |
| Shelf Unit            | Basic structural unit representing 0.5 meters of shelf length |
| Efficiency Heatmap    | A color-coded visualization where shelf colors correspond to sales efficiency values (yuan/meter) |

## 2. Core Functional Requirements
### 2.1 Visual Shelf Layout Construction
#### 2.1.1 Layout Foundation
- The application displays a top-down view of the store as the canvas area, allowing users to freely build shelf layouts within this area.
- Provide standardized shelf units (each representing 0.5 meters of shelf), enabling users to **drag and drop** shelf units to any position on the top view.
- Support two shelf orientations:
  - **Horizontal Shelf**: Width varies based on length, fixed height (20px visual representation)
  - **Vertical Shelf**: Height varies based on length, fixed width (20px visual representation)
- Grid-based positioning with 20px grid snapping for precise alignment.

#### 2.1.2 Shelf Attribute Configuration
- Users may click any placed shelf or shelf unit to set its corresponding product category.
- **Drag-and-Drop Category Assignment (NEW)**: Users can drag a product category from the left sidebar and drop it onto a shelf to assign the category.
- Support assigning uniform or different product categories to individual shelf units or entire connected shelf sections.
- **Default Color Rule**: Shelves with no assigned product category shall display as **gray** by default.
- After a shelf is labeled with a product category, a distinct color is automatically generated; users may also manually specify colors.
- **Category Color Synchronization**: When a user manually changes a shelf's color, the category's color in the sidebar updates automatically, and all shelves with that category will use the new color.

#### 2.1.3 Shelf Resizing (NEW)
- Users can **stretch shelves** to adjust their length by dragging the resize handle at the edge of each shelf.
- Resize behavior:
  - **Horizontal shelves**: Drag the right edge to extend/reduce width
  - **Vertical shelves**: Drag the bottom edge to extend/reduce height
- Length snaps to 0.5-meter increments (minimum length: 0.5 meters)
- Visual feedback shows resize handle on hover

#### 2.1.4 Shelf Label Display (NEW)
- Each shelf displays a label showing the assigned product category name.
- Label positioning:
  - **Horizontal shelves**: Label appears above the shelf
  - **Vertical shelves**: Label appears to the left of the shelf
- Label styling: Dark text on semi-transparent white background for optimal readability across all shelf colors.

### 2.2 Canvas Zoom & Pan Control (NEW)
#### 2.2.1 Zoom Functionality
- Support **zoom in/out** functionality to accommodate different store sizes.
- Zoom controls located in the header bar:
  - **Zoom Out (-)**: Decrease zoom level (minimum 25%)
  - **Zoom Level Display**: Shows current zoom percentage
  - **Zoom In (+)**: Increase zoom level (maximum 300%)
  - **Reset Button**: Return to 100% zoom and reset pan position
- Zoom range: 25% to 300%
- Canvas scales proportionally while maintaining shelf positions and proportions.

#### 2.2.2 Pan Functionality
- Support **canvas panning** when zoomed in/out.
- Users can click and drag on the canvas background to move the view.
- Panning works independently of shelf dragging (only activates when clicking on empty canvas area).
- Pan position is reset when clicking the reset zoom button.

### 2.3 Sales Data Import & Matching
#### 2.3.1 Data Import
- Support users in importing sales data files in Excel (.xlsx/.xls) or CSV format.
- Data files must include core fields: product category, turnover (support custom field mapping configuration).
- Automatic field detection for common column names (category, turnover, sales, revenue, etc.).

#### 2.3.2 Data Matching
- The application automatically matches "product category" from imported data with "product category" configured on shelves.
- Support scenarios where the same product category is placed on multiple shelves, automatically summing the total shelf length occupied by that category.

### 2.4 Sales Efficiency Calculation & Display
#### 2.4.1 Manual Calculation Trigger
- After importing sales data, users must click a dedicated **"Calculate" button** to initiate the sales efficiency calculation process.
- A loading prompt shall be displayed during calculation to indicate processing status.

#### 2.4.2 Efficiency Calculation Logic
- Single-shelf efficiency: Turnover of the corresponding product / Total length of the shelf (meters).
- Multi-shelf same-category efficiency: Total turnover of the category / Total shelf length occupied by the category (meters).
- Calculations are rounded to 2 decimal places, with the uniform unit: yuan/meter.

#### 2.4.3 Dual-Mode Visual Presentation (Color)
The application shall provide two switchable color display modes for shelves after calculation:
1. **Product Category Mode (Default)**:
   - Shelves retain the distinct colors assigned based on product categories (automatically generated or manually specified by users).
   - This mode is used to distinguish shelves by the type of products they hold.
2. **Efficiency Heatmap Mode**:
   - Shelf colors are dynamically updated to reflect sales efficiency values (yuan/meter) based on a predefined color gradient scale.
   - **Color Gradient**: Red (low efficiency) → Yellow (medium efficiency) → Green (high efficiency)
   - A color legend shall be displayed on the interface to clarify the correspondence between colors and efficiency ranges.
- Users can switch between the two modes via a toggle button on the interface.

#### 2.4.4 Hover Tooltip Display
- When hovering the mouse over any shelf, a tooltip displays key information: product type (if assigned), shelf length, corresponding turnover, and calculated sales efficiency.
- For gray (unassigned) shelves, the tooltip shall only display shelf length with a prompt indicating "No product category assigned".

### 2.5 Layout Management (NEW)
#### 2.5.1 Save Layout (JSON)
- Users can **save** the current shelf layout as a JSON file containing:
  - Layout version and timestamp
  - Category definitions (including colors)
  - Shelf positions, types, lengths, categories, and colors
- JSON files can be reloaded to restore the complete layout.

#### 2.5.2 Load Layout
- Users can **load** a previously saved layout from a JSON file.
- Loading a layout will:
  - Clear the current canvas
  - Restore category definitions with colors
  - Restore all shelves with their positions, categories, colors, and lengths
  - Reset the history for undo/redo operations

#### 2.5.3 Export Data (CSV)
- Users can **export** efficiency data as a CSV file for analysis:
  - Category name
  - Color (hex code)
  - Shelf length (meters)
  - Turnover (if calculated)
  - Efficiency (if calculated)
- CSV files are for reporting/analysis and cannot be reloaded into the application.

### 2.6 Undo/Redo Operations
- Support **undo (Ctrl+Z)** and **redo (Ctrl+Y)** operations for all layout changes.
- Undo/redo covers: shelf placement, movement, resizing, category assignment, and deletion.
- History limit: 50 states.

### 2.7 Remote Access (NEW)
#### 2.7.1 Tunnel Service
- Support generating a **public access URL** using Cloudflare Tunnel.
- Allows sharing the application with remote users without deploying to a server.
- Command to start tunnel: `cloudflared tunnel --url http://localhost:8000`
- Generated URL can be shared with others for collaborative analysis.

## 3. Non-Functional Requirements
### 3.1 User Experience
- Smooth drag-and-drop operations with no obvious lag (response delay ≤ 300ms).
- Efficiency calculation after clicking "Calculate" ≤ 5 seconds (single import ≤ 1000 records).
- Support undo/redo operations for easy adjustment of shelf layouts.
- Mode switching (category/heatmap) shall take effect immediately (≤ 200ms) without page reload.
- Shelf resizing shall provide real-time visual feedback.

### 3.2 Compatibility
- Compatible with major browsers: Chrome (≥80), Firefox (≥75), Edge (≥80), Safari (≥13).
- Adapt to mainstream desktop resolutions (1366×768 and above).

### 3.3 Data Security
- Imported sales data is processed locally on the front end only and not stored on the server.
- Support data export, allowing shelf layout + sales efficiency data to be exported as CSV format.
- Layout files are stored locally on the user's device.

## 4. Business Value
### 4.1 Core Value
- Visualization: Combines abstract sales data with physical shelf layout to lower the barrier for operational analysis.
- Data-driven: Quantifies shelf value through sales efficiency to guide the allocation of shelf resources toward high-margin categories.
- Flexibility: Dual-color modes enable both product category identification and efficiency performance analysis in one tool.
- Cost reduction & efficiency improvement: Reduces time spent on manual shelf efficiency calculations and improves decision-making efficiency for shelf layout adjustments.
- Collaboration: Remote access capability enables team collaboration without server deployment.

### 4.2 Expected Outcomes
- Help stores identify low-efficiency shelf areas, with overall shelf sales efficiency increased by ≥10% after optimization.
- Shorten decision cycles for shelf layout adjustments, shifting from "experience-based judgment" to "data-driven decisions".
- Improve the clarity of shelf performance visualization, reducing the time required for operations staff to analyze shelf data by ≥20%.

## 5. Project Success Metrics
| Metric Type        | Specific Metric                                  |
|--------------------|--------------------------------------------------|
| Function Completeness | 100% implementation of core functions with no critical defects |
| User Experience    | User satisfaction with interactive operations ≥90% (user survey) |
| Performance        | Data calculation response time ≤5 seconds; mode switching delay ≤200ms |
| Business Value     | Shelf efficiency improved by ≥10% in pilot stores |

## 6. Technical Implementation
### 6.1 Technology Stack
| Component | Technology |
|-----------|------------|
| Backend | Python 3.12 + FastAPI |
| Frontend | HTML5 + CSS3 + Vanilla JavaScript |
| Data Processing | Pandas (Excel/CSV parsing) |
| Server | Uvicorn (ASGI server) |

### 6.2 Project Structure
```
store-layout-web/
├── main.py                 # FastAPI application
├── pyproject.toml          # Python dependencies
├── BRD.md                  # Business Requirements Document
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Main HTML template
├── static/
│   ├── css/
│   │   └── styles.css      # Application styles
│   └── js/
│       └── app.js          # Frontend JavaScript
└── sample_sales_data.csv   # Sample data for testing
```

### 6.3 API Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve main application page |
| `/api/product-categories` | GET | Get default product categories |
| `/api/import-sales` | POST | Import sales data from Excel/CSV |
| `/api/calculate-efficiency` | POST | Calculate sales efficiency for shelves |

---
### Summary
1. The core workflow is **build shelf layout → assign product categories (drag & drop) → import sales data → click "Calculate" → switch between category/heatmap color modes**, ensuring a complete and flexible analysis process.
2. Key color rules: **gray for unassigned shelves**, category-specific colors for Product Category Mode, and **red-yellow-green gradient** for Efficiency Heatmap Mode (with a legend).
3. Critical calculation logic: **turnover / total shelf length** (aggregating lengths for the same product across multiple shelves), triggered manually by the "Calculate" button post data import.
4. Enhanced features: **shelf resizing**, **zoom & pan control**, **layout save/load (JSON)**, **CSV export**, and **remote access** for improved usability and collaboration.
5. Data management: **Save** creates JSON layouts (reloadable), **Export CSV** generates efficiency reports with color information.

---
## 7. Version History
| Version | Date | Changes |
|---------|------|---------|
| V1.0 | March 20, 2026 | Initial BRD |
| V2.0 | March 20, 2026 | Added: shelf resizing, zoom control, layout export/load, remote access, improved heatmap colors (red-yellow-green), shelf label positioning, category color synchronization |
| V2.1 | March 20, 2026 | Added: drag-and-drop category assignment, canvas panning, separated Save (JSON) and Export CSV functions, color info in CSV export, category definitions in layout JSON |