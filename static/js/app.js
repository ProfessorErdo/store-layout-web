/**
 * Store Product Sales Efficiency Analysis Tool
 * Main Application JavaScript
 */

// ==================== State Management ====================
const state = {
    shelves: [],
    categories: [],
    salesData: [],
    efficiencyResults: null,
    selectedShelf: null,
    colorMode: 'category', // 'category' or 'heatmap'
    efficiencyRange: { min: 0, max: 1000 },
    history: [],
    historyIndex: -1,
    isDragging: false,
    isResizing: false,
    isPanning: false,
    dragOffset: { x: 0, y: 0 },
    resizeHandle: null,
    zoomLevel: 1,
    panOffset: { x: 0, y: 0 }
};

// ==================== Constants ====================
const SHELF_UNIT_LENGTH = 0.5; // meters
const SHELF_WIDTH = 20; // pixels
const SHELF_HEIGHT = 60; // pixels for horizontal
const GRID_SIZE = 20;

// ==================== DOM Elements ====================
const elements = {
    canvas: null,
    tooltip: null,
    modal: null,
    fileInput: null,
    importBtn: null,
    calculateBtn: null,
    undoBtn: null,
    redoBtn: null,
    clearBtn: null,
    exportBtn: null,
    saveLayoutBtn: null,
    loadLayoutBtn: null,
    layoutFileInput: null,
    zoomInBtn: null,
    zoomOutBtn: null,
    zoomResetBtn: null,
    zoomLevel: null,
    categoryModeBtn: null,
    heatmapModeBtn: null,
    heatmapLegend: null,
    categoryList: null,
    summaryPanel: null,
    shelfInfoPanel: null,
    importStatus: null,
    calculationStatus: null
};

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeEventListeners();
    loadCategories();
    initializeDragAndDrop();
    initCanvasPanning();
});

function initializeElements() {
    elements.canvas = document.getElementById('canvas');
    elements.tooltip = document.getElementById('tooltip');
    elements.modal = document.getElementById('shelfConfigModal');
    elements.fileInput = document.getElementById('fileInput');
    elements.importBtn = document.getElementById('importBtn');
    elements.calculateBtn = document.getElementById('calculateBtn');
    elements.undoBtn = document.getElementById('undoBtn');
    elements.redoBtn = document.getElementById('redoBtn');
    elements.clearBtn = document.getElementById('clearBtn');
    elements.exportBtn = document.getElementById('exportBtn');
    elements.saveLayoutBtn = document.getElementById('saveLayoutBtn');
    elements.loadLayoutBtn = document.getElementById('loadLayoutBtn');
    elements.layoutFileInput = document.getElementById('layoutFileInput');
    elements.zoomInBtn = document.getElementById('zoomInBtn');
    elements.zoomOutBtn = document.getElementById('zoomOutBtn');
    elements.zoomResetBtn = document.getElementById('zoomResetBtn');
    elements.zoomLevel = document.getElementById('zoomLevel');
    elements.categoryModeBtn = document.getElementById('categoryModeBtn');
    elements.heatmapModeBtn = document.getElementById('heatmapModeBtn');
    elements.heatmapLegend = document.getElementById('heatmapLegend');
    elements.categoryList = document.getElementById('categoryList');
    elements.summaryPanel = document.getElementById('summaryPanel');
    elements.shelfInfoPanel = document.getElementById('shelfInfoPanel');
    elements.importStatus = document.getElementById('importStatus');
    elements.calculationStatus = document.getElementById('calculationStatus');
}

function initializeEventListeners() {
    // Import button
    elements.importBtn.addEventListener('click', () => elements.fileInput.click());
    elements.fileInput.addEventListener('change', handleFileImport);
    
    // Calculate button
    elements.calculateBtn.addEventListener('click', handleCalculate);
    
    // Undo/Redo
    elements.undoBtn.addEventListener('click', handleUndo);
    elements.redoBtn.addEventListener('click', handleRedo);
    
    // Clear
    elements.clearBtn.addEventListener('click', handleClearAll);
    
    // Export
    elements.exportBtn.addEventListener('click', handleExport);

    // Save/Load Layout
    elements.saveLayoutBtn.addEventListener('click', handleSaveLayout);
    elements.loadLayoutBtn.addEventListener('click', () => elements.layoutFileInput.click());
    elements.layoutFileInput.addEventListener('change', handleLoadLayout);

    // Zoom controls
    elements.zoomInBtn.addEventListener('click', () => handleZoom(0.1));
    elements.zoomOutBtn.addEventListener('click', () => handleZoom(-0.1));
    elements.zoomResetBtn.addEventListener('click', resetZoom);

    // Color mode toggle
    elements.categoryModeBtn.addEventListener('click', () => setColorMode('category'));
    elements.heatmapModeBtn.addEventListener('click', () => setColorMode('heatmap'));
    
    // Modal
    document.querySelector('.modal-close').addEventListener('click', closeModal);
    document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    document.getElementById('saveShelfBtn').addEventListener('click', saveShelfConfig);
    document.getElementById('deleteShelfBtn').addEventListener('click', deleteSelectedShelf);
    
    // Color picker sync
    document.getElementById('shelfColorPicker').addEventListener('input', (e) => {
        document.getElementById('shelfColorHex').value = e.target.value;
    });
    document.getElementById('shelfColorHex').addEventListener('input', (e) => {
        const hex = e.target.value;
        if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            document.getElementById('shelfColorPicker').value = hex;
        }
    });

    // Category select - update color picker when category changes
    document.getElementById('shelfCategorySelect').addEventListener('change', (e) => {
        const categoryId = e.target.value;
        if (categoryId) {
            const category = state.categories.find(c => c.id === categoryId);
            if (category) {
                document.getElementById('shelfColorPicker').value = category.color;
                document.getElementById('shelfColorHex').value = category.color;
            }
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) {
                    handleRedo();
                } else {
                    handleUndo();
                }
            } else if (e.key === 'y') {
                e.preventDefault();
                handleRedo();
            }
        }
        if (e.key === 'Delete' && state.selectedShelf) {
            deleteSelectedShelf();
        }
        if (e.key === 'Escape') {
            closeModal();
            deselectShelf();
        }
    });
    
    // Canvas click to deselect
    elements.canvas.addEventListener('click', (e) => {
        if (e.target === elements.canvas || e.target.classList.contains('canvas-grid')) {
            deselectShelf();
        }
    });
}

// ==================== API Functions ====================
async function loadCategories() {
    try {
        const response = await fetch('/api/product-categories');
        const data = await response.json();
        if (data.success) {
            state.categories = data.categories;
            renderCategoryList();
            populateCategorySelect();
        }
    } catch (error) {
        console.error('Error loading categories:', error);
        // Use default categories if API fails
        state.categories = [
            { id: 'football', name: 'Football', color: '#4CAF50' },
            { id: 'basketball', name: 'Basketball', color: '#FF9800' },
            { id: 'tennis', name: 'Tennis', color: '#2196F3' },
            { id: 'table_tennis', name: 'Table Tennis', color: '#9C27B0' },
            { id: 'badminton', name: 'Badminton', color: '#00BCD4' },
            { id: 'swimming', name: 'Swimming', color: '#3F51B5' },
            { id: 'running', name: 'Running', color: '#E91E63' },
            { id: 'yoga', name: 'Yoga', color: '#795548' },
            { id: 'cycling', name: 'Cycling', color: '#607D8B' },
            { id: 'fitness', name: 'Fitness', color: '#FF5722' },
        ];
        renderCategoryList();
        populateCategorySelect();
    }
}

async function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        elements.importBtn.disabled = true;
        elements.importBtn.innerHTML = '<span class="material-icons">hourglass_empty</span> Importing...';
        
        const response = await fetch('/api/import-sales', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.salesData = data.data;
            elements.importStatus.classList.remove('hidden');
            document.getElementById('importStatusText').textContent = 
                `Imported ${data.total_records} categories`;
            elements.calculateBtn.disabled = false;
        } else {
            throw new Error(data.detail || 'Import failed');
        }
    } catch (error) {
        console.error('Import error:', error);
        alert('Error importing file: ' + error.message);
    } finally {
        elements.importBtn.disabled = false;
        elements.importBtn.innerHTML = '<span class="material-icons">upload_file</span> Import Sales Data';
        elements.fileInput.value = '';
    }
}

async function handleCalculate() {
    if (state.shelves.length === 0) {
        alert('Please add shelves to the canvas first.');
        return;
    }
    
    if (state.salesData.length === 0) {
        alert('Please import sales data first.');
        return;
    }
    
    elements.calculateBtn.disabled = true;
    elements.calculationStatus.classList.remove('hidden');
    
    try {
        const shelfData = state.shelves.map(shelf => ({
            id: shelf.id,
            category: shelf.category || 'unassigned',
            length: shelf.length
        }));
        
        const response = await fetch('/api/calculate-efficiency', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sales_data: state.salesData,
                shelf_data: shelfData
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.efficiencyResults = data;
            state.efficiencyRange = data.efficiency_range;
            updateShelfEfficiency(data.shelf_results);
            updateSummaryPanel(data);
            
            if (state.colorMode === 'heatmap') {
                applyHeatmapColors();
            }
        }
    } catch (error) {
        console.error('Calculation error:', error);
        alert('Error calculating efficiency: ' + error.message);
    } finally {
        elements.calculateBtn.disabled = false;
        elements.calculationStatus.classList.add('hidden');
    }
}

// ==================== Drag and Drop ====================
function initializeDragAndDrop() {
    const templates = document.querySelectorAll('.shelf-unit-template');
    
    templates.forEach(template => {
        template.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('type', template.dataset.type);
            e.dataTransfer.effectAllowed = 'copy';
        });
    });
    
    elements.canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });
    
    elements.canvas.addEventListener('drop', (e) => {
        e.preventDefault();
        const type = e.dataTransfer.getData('type');
        if (type) {
            const rect = elements.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            createShelf(type, x, y);
        }
    });
}

// ==================== Shelf Management ====================
function createShelf(type, x, y, config = {}) {
    const id = 'shelf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    // Snap to grid
    const snappedX = Math.round(x / GRID_SIZE) * GRID_SIZE;
    const snappedY = Math.round(y / GRID_SIZE) * GRID_SIZE;
    
    const shelf = {
        id,
        type,
        x: snappedX,
        y: snappedY,
        length: config.length || SHELF_UNIT_LENGTH,
        category: config.category || null,
        color: config.color || null,
        efficiency: 0,
        turnover: 0
    };
    
    state.shelves.push(shelf);
    renderShelf(shelf);
    saveToHistory();
    hideCanvasHint();
}

function renderShelf(shelf) {
    const existingEl = document.getElementById(shelf.id);
    if (existingEl) existingEl.remove();
    
    const el = document.createElement('div');
    el.id = shelf.id;
    el.className = 'shelf-item';
    if (!shelf.category) el.classList.add('unassigned');
    
    // Calculate dimensions
    const lengthPx = (shelf.length / SHELF_UNIT_LENGTH) * SHELF_HEIGHT;
    
    if (shelf.type === 'horizontal') {
        el.style.width = lengthPx + 'px';
        el.style.height = SHELF_WIDTH + 'px';
    } else {
        el.style.width = SHELF_WIDTH + 'px';
        el.style.height = lengthPx + 'px';
    }
    
    el.style.left = shelf.x + 'px';
    el.style.top = shelf.y + 'px';
    
    // Set color
    updateShelfColor(el, shelf);
    
    // Add label
    if (shelf.category) {
        const category = state.categories.find(c => c.id === shelf.category);
        if (category) {
            const label = document.createElement('div');
            label.className = 'shelf-label';
            label.textContent = category.name.substring(0, 10);
            
            if (shelf.type === 'horizontal') {
                // Position on top for horizontal shelves
                label.style.top = '-18px';
                label.style.left = '4px';
                label.style.whiteSpace = 'nowrap';
            } else {
                // Position on left for vertical shelves
                label.style.left = '-4px';
                label.style.top = '4px';
                label.style.transform = 'translateX(-100%)';
                label.style.whiteSpace = 'nowrap';
            }
            
            el.appendChild(label);
        }
    }
    
    // Event listeners
    el.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('shelf-resize-handle')) {
            startResize(e, shelf);
        } else {
            startDrag(e, shelf);
        }
    });
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        selectShelf(shelf);
    });
    el.addEventListener('mouseenter', (e) => showTooltip(e, shelf));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        openShelfConfig(shelf);
    });
    
    // Category drop handling
    el.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', (e) => {
        el.classList.remove('drop-target');
    });
    el.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('drop-target');
        
        const categoryId = e.dataTransfer.getData('category');
        if (categoryId) {
            // Assign category to this shelf
            shelf.category = categoryId;
            shelf.color = null; // Use category's default color
            renderShelf(shelf);
            selectShelf(shelf);
            saveToHistory();
        }
    });

    // Add resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'shelf-resize-handle';
    resizeHandle.dataset.shelfId = shelf.id;
    if (shelf.type === 'horizontal') {
        resizeHandle.style.right = '-4px';
        resizeHandle.style.top = '0';
        resizeHandle.style.width = '8px';
        resizeHandle.style.height = '100%';
        resizeHandle.style.cursor = 'ew-resize';
    } else {
        resizeHandle.style.bottom = '-4px';
        resizeHandle.style.left = '0';
        resizeHandle.style.width = '100%';
        resizeHandle.style.height = '8px';
        resizeHandle.style.cursor = 'ns-resize';
    }
    el.appendChild(resizeHandle);

    elements.canvas.appendChild(el);
}

function updateShelfColor(el, shelf) {
    if (state.colorMode === 'heatmap' && shelf.efficiency > 0) {
        el.style.backgroundColor = getHeatmapColor(shelf.efficiency);
    } else if (shelf.color) {
        el.style.backgroundColor = shelf.color;
    } else if (shelf.category) {
        const category = state.categories.find(c => c.id === shelf.category);
        el.style.backgroundColor = category ? category.color : '#9ca3af';
    } else {
        el.style.backgroundColor = '#9ca3af';
    }
}

function getHeatmapColor(efficiency) {
    const { min, max } = state.efficiencyRange;
    const range = max - min || 1;
    const normalized = Math.min(Math.max((efficiency - min) / range, 0), 1);

    // Gradient: red (low efficiency) -> yellow (mid) -> green (high efficiency)
    let r, g, b;
    if (normalized < 0.5) {
        // Red to Yellow
        const t = normalized * 2;
        r = 239;
        g = Math.round(68 + (179 - 68) * t);
        b = 68;
    } else {
        // Yellow to Green
        const t = (normalized - 0.5) * 2;
        r = Math.round(239 - (239 - 34) * t);
        g = Math.round(179 + (197 - 179) * t);
        b = Math.round(68 + (94 - 68) * t);
    }

    return `rgb(${r}, ${g}, ${b})`;
}

function updateShelfEfficiency(results) {
    results.forEach(result => {
        const shelf = state.shelves.find(s => s.id === result.shelf_id);
        if (shelf) {
            shelf.efficiency = result.efficiency;
            shelf.turnover = result.turnover;
        }
    });
    
    // Re-render all shelves with new efficiency
    state.shelves.forEach(shelf => {
        const el = document.getElementById(shelf.id);
        if (el) {
            updateShelfColor(el, shelf);
        }
    });
}

// ==================== Drag Handling ====================
function startDrag(e, shelf) {
    if (e.button !== 0) return;
    
    state.isDragging = true;
    state.selectedShelf = shelf;
    
    const el = document.getElementById(shelf.id);
    const rect = el.getBoundingClientRect();
    
    state.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
    };
    
    el.classList.add('dragging');
    
    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', stopDrag);
}

function handleDrag(e) {
    if (!state.isDragging || !state.selectedShelf) return;
    
    const canvasRect = elements.canvas.getBoundingClientRect();
    let x = e.clientX - canvasRect.left - state.dragOffset.x;
    let y = e.clientY - canvasRect.top - state.dragOffset.y;
    
    // Snap to grid
    x = Math.round(x / GRID_SIZE) * GRID_SIZE;
    y = Math.round(y / GRID_SIZE) * GRID_SIZE;
    
    // Keep within bounds
    x = Math.max(0, x);
    y = Math.max(0, y);
    
    state.selectedShelf.x = x;
    state.selectedShelf.y = y;
    
    const el = document.getElementById(state.selectedShelf.id);
    if (el) {
        el.style.left = x + 'px';
        el.style.top = y + 'px';
    }
}

function stopDrag() {
    if (state.isDragging && state.selectedShelf) {
        const el = document.getElementById(state.selectedShelf.id);
        if (el) el.classList.remove('dragging');
        saveToHistory();
    }

    state.isDragging = false;
    document.removeEventListener('mousemove', handleDrag);
    document.removeEventListener('mouseup', stopDrag);
}

// ==================== Resize Handling ====================
function startResize(e, shelf) {
    e.stopPropagation();
    e.preventDefault();
    
    state.isResizing = true;
    state.selectedShelf = shelf;
    state.resizeStartX = e.clientX;
    state.resizeStartY = e.clientY;
    state.resizeStartLength = shelf.length;
    
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
}

function handleResize(e) {
    if (!state.isResizing || !state.selectedShelf) return;
    
    const shelf = state.selectedShelf;
    const el = document.getElementById(shelf.id);
    if (!el) return;
    
    // Calculate delta in pixels
    let deltaPx;
    if (shelf.type === 'horizontal') {
        deltaPx = e.clientX - state.resizeStartX;
    } else {
        deltaPx = e.clientY - state.resizeStartY;
    }
    
    // Convert to length units (snap to 0.5m increments)
    const deltaUnits = Math.round(deltaPx / SHELF_HEIGHT);
    let newLength = state.resizeStartLength + (deltaUnits * SHELF_UNIT_LENGTH);
    
    // Minimum length is 0.5m
    newLength = Math.max(SHELF_UNIT_LENGTH, newLength);
    
    // Update shelf
    shelf.length = newLength;
    
    // Update element dimensions
    const lengthPx = (newLength / SHELF_UNIT_LENGTH) * SHELF_HEIGHT;
    if (shelf.type === 'horizontal') {
        el.style.width = lengthPx + 'px';
    } else {
        el.style.height = lengthPx + 'px';
    }
}

function stopResize() {
    if (state.isResizing && state.selectedShelf) {
        saveToHistory();
    }
    
    state.isResizing = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
}

// ==================== Selection ====================
function selectShelf(shelf) {
    deselectShelf();
    state.selectedShelf = shelf;
    const el = document.getElementById(shelf.id);
    if (el) el.classList.add('selected');
    updateShelfInfoPanel(shelf);
}

function deselectShelf() {
    if (state.selectedShelf) {
        const el = document.getElementById(state.selectedShelf.id);
        if (el) el.classList.remove('selected');
    }
    state.selectedShelf = null;
    resetShelfInfoPanel();
}

// ==================== Modal ====================
function openShelfConfig(shelf) {
    state.selectedShelf = shelf;

    const categorySelect = document.getElementById('shelfCategorySelect');
    const colorPicker = document.getElementById('shelfColorPicker');
    const colorHex = document.getElementById('shelfColorHex');
    const lengthInput = document.getElementById('shelfLengthInput');

    // Set current values
    categorySelect.value = shelf.category || '';

    // Get the category's default color if a category is assigned
    const categoryDefaultColor = shelf.category ? 
        (state.categories.find(c => c.id === shelf.category)?.color || '#9ca3af') : '#9ca3af';
    
    // Use shelf's custom color if set, otherwise use category's default color
    const currentColor = shelf.color || categoryDefaultColor;
    colorPicker.value = currentColor;
    colorHex.value = currentColor;

    lengthInput.value = shelf.length;

    elements.modal.classList.remove('hidden');
}

function closeModal() {
    elements.modal.classList.add('hidden');
}

function saveShelfConfig() {
    if (!state.selectedShelf) return;

    const category = document.getElementById('shelfCategorySelect').value || null;
    const color = document.getElementById('shelfColorHex').value;
    const length = parseFloat(document.getElementById('shelfLengthInput').value) || SHELF_UNIT_LENGTH;

    // Get the category's default color
    const categoryData = category ? state.categories.find(c => c.id === category) : null;
    const categoryDefaultColor = categoryData ? categoryData.color : null;

    // Update shelf properties
    state.selectedShelf.category = category;
    state.selectedShelf.length = length;

    // If color is different from category's default, it's a custom color
    // Also update the category's color in the state
    if (category && color !== categoryDefaultColor) {
        // Update the category's color
        const catIndex = state.categories.findIndex(c => c.id === category);
        if (catIndex !== -1) {
            state.categories[catIndex].color = color;
        }
        state.selectedShelf.color = null; // Use category's color (which is now updated)
        // Re-render category list to show new color
        renderCategoryList();
    } else {
        // Use category's default color (no custom color needed)
        state.selectedShelf.color = null;
    }

    renderShelf(state.selectedShelf);
    selectShelf(state.selectedShelf);
    saveToHistory();
    closeModal();
}

function deleteSelectedShelf() {
    if (!state.selectedShelf) return;
    
    const el = document.getElementById(state.selectedShelf.id);
    if (el) el.remove();
    
    state.shelves = state.shelves.filter(s => s.id !== state.selectedShelf.id);
    state.selectedShelf = null;
    saveToHistory();
    closeModal();
    resetShelfInfoPanel();
    
    if (state.shelves.length === 0) {
        showCanvasHint();
    }
}

// ==================== Tooltip ====================
function showTooltip(e, shelf) {
    if (state.isDragging) return;
    
    const content = document.querySelector('.tooltip-content');
    let html = '';
    
    if (shelf.category) {
        const category = state.categories.find(c => c.id === shelf.category);
        html += `<div class="tooltip-row">
            <span class="tooltip-label">Category:</span>
            <span class="tooltip-value">${category?.name || shelf.category}</span>
        </div>`;
    } else {
        html += `<div class="tooltip-row">
            <span class="tooltip-label">Status:</span>
            <span class="tooltip-value" style="color: #fbbf24">No category assigned</span>
        </div>`;
    }
    
    html += `<div class="tooltip-row">
        <span class="tooltip-label">Length:</span>
        <span class="tooltip-value">${shelf.length} m</span>
    </div>`;
    
    if (shelf.category && shelf.efficiency > 0) {
        html += `<div class="tooltip-row">
            <span class="tooltip-label">Turnover:</span>
            <span class="tooltip-value">¥${shelf.turnover.toLocaleString()}</span>
        </div>
        <div class="tooltip-row">
            <span class="tooltip-label">Efficiency:</span>
            <span class="tooltip-value" style="color: #10b981">¥${shelf.efficiency}/m</span>
        </div>`;
    }
    
    content.innerHTML = html;
    
    const tooltip = elements.tooltip;
    tooltip.classList.remove('hidden');
    
    // Position tooltip
    const rect = tooltip.getBoundingClientRect();
    let x = e.clientX + 15;
    let y = e.clientY + 15;
    
    if (x + rect.width > window.innerWidth) {
        x = e.clientX - rect.width - 15;
    }
    if (y + rect.height > window.innerHeight) {
        y = e.clientY - rect.height - 15;
    }
    
    tooltip.style.left = x + 'px';
    tooltip.style.top = y + 'px';
}

function hideTooltip() {
    elements.tooltip.classList.add('hidden');
}

// ==================== Color Mode ====================
function setColorMode(mode) {
    state.colorMode = mode;
    
    elements.categoryModeBtn.classList.toggle('active', mode === 'category');
    elements.heatmapModeBtn.classList.toggle('active', mode === 'heatmap');
    elements.heatmapLegend.classList.toggle('hidden', mode === 'category');
    
    if (mode === 'heatmap' && state.efficiencyResults) {
        applyHeatmapColors();
        updateLegendLabels();
    } else {
        applyCategoryColors();
    }
}

function applyHeatmapColors() {
    state.shelves.forEach(shelf => {
        const el = document.getElementById(shelf.id);
        if (el) {
            updateShelfColor(el, shelf);
        }
    });
}

function applyCategoryColors() {
    state.shelves.forEach(shelf => {
        const el = document.getElementById(shelf.id);
        if (el) {
            updateShelfColor(el, shelf);
        }
    });
}

function updateLegendLabels() {
    document.getElementById('legendMin').textContent = state.efficiencyRange.min.toFixed(0);
    document.getElementById('legendMax').textContent = state.efficiencyRange.max.toFixed(0);
}

// ==================== History (Undo/Redo) ====================
function saveToHistory() {
    // Remove any future states if we're not at the end
    state.history = state.history.slice(0, state.historyIndex + 1);
    
    // Save current state
    state.history.push(JSON.stringify(state.shelves));
    state.historyIndex = state.history.length - 1;
    
    // Limit history size
    if (state.history.length > 50) {
        state.history.shift();
        state.historyIndex--;
    }
    
    updateHistoryButtons();
}

function handleUndo() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        restoreFromHistory();
    }
}

function handleRedo() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        restoreFromHistory();
    }
}

function restoreFromHistory() {
    state.shelves = JSON.parse(state.history[state.historyIndex]);
    
    // Clear and re-render all shelves
    document.querySelectorAll('.shelf-item').forEach(el => el.remove());
    state.shelves.forEach(shelf => renderShelf(shelf));
    
    updateHistoryButtons();
    
    if (state.shelves.length === 0) {
        showCanvasHint();
    } else {
        hideCanvasHint();
    }
}

function updateHistoryButtons() {
    elements.undoBtn.disabled = state.historyIndex <= 0;
    elements.redoBtn.disabled = state.historyIndex >= state.history.length - 1;
}

// ==================== UI Updates ====================
function renderCategoryList() {
    elements.categoryList.innerHTML = state.categories.map(cat => `
        <div class="category-item" data-category="${cat.id}" draggable="true" title="Drag to a shelf to assign category">
            <div class="category-color" style="background-color: ${cat.color}"></div>
            <span class="category-name">${cat.name}</span>
        </div>
    `).join('');
    
    // Add drag event listeners to category items
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('category', item.dataset.category);
            e.dataTransfer.effectAllowed = 'copy';
            item.classList.add('dragging');
        });
        item.addEventListener('dragend', (e) => {
            item.classList.remove('dragging');
        });
    });
}

function populateCategorySelect() {
    const select = document.getElementById('shelfCategorySelect');
    select.innerHTML = '<option value="">-- Unassigned --</option>' +
        state.categories.map(cat => 
            `<option value="${cat.id}">${cat.name}</option>`
        ).join('');
}

function updateShelfInfoPanel(shelf) {
    const category = shelf.category ? 
        state.categories.find(c => c.id === shelf.category) : null;
    
    elements.shelfInfoPanel.innerHTML = `
        <div class="shelf-info-content">
            <div class="shelf-info-row">
                <span class="shelf-info-label">Category</span>
                <span class="shelf-info-value">${category?.name || 'Unassigned'}</span>
            </div>
            <div class="shelf-info-row">
                <span class="shelf-info-label">Length</span>
                <span class="shelf-info-value">${shelf.length} m</span>
            </div>
            ${shelf.efficiency > 0 ? `
            <div class="shelf-info-row">
                <span class="shelf-info-label">Turnover</span>
                <span class="shelf-info-value">¥${shelf.turnover.toLocaleString()}</span>
            </div>
            <div class="shelf-info-row">
                <span class="shelf-info-label">Efficiency</span>
                <span class="shelf-info-value" style="color: #10b981">¥${shelf.efficiency}/m</span>
            </div>
            ` : ''}
            <div class="shelf-info-actions">
                <button class="btn btn-secondary full-width" onclick="openShelfConfig(state.selectedShelf)">
                    <span class="material-icons">edit</span>
                    Configure
                </button>
            </div>
        </div>
    `;
}

function resetShelfInfoPanel() {
    elements.shelfInfoPanel.innerHTML = `
        <div class="info-empty">
            <span class="material-icons">touch_app</span>
            <p>Click a shelf to view details</p>
        </div>
    `;
}

function updateSummaryPanel(data) {
    const { shelf_results, category_summary } = data;
    
    const totalShelves = shelf_results.length;
    const assignedShelves = shelf_results.filter(r => r.status === 'calculated').length;
    const avgEfficiency = assignedShelves > 0 ?
        (shelf_results.reduce((sum, r) => sum + r.efficiency, 0) / assignedShelves).toFixed(2) : 0;
    
    let categoryHtml = '';
    if (category_summary && Object.keys(category_summary).length > 0) {
        categoryHtml = `
            <div class="category-summary">
                <div class="category-summary-title">By Category</div>
                ${Object.entries(category_summary).map(([cat, data]) => {
                    const category = state.categories.find(c => c.id === cat);
                    return `
                        <div class="category-stat">
                            <div class="category-stat-color" style="background-color: ${category?.color || '#9ca3af'}"></div>
                            <span class="category-stat-name">${category?.name || cat}</span>
                            <span class="category-stat-efficiency">¥${data.efficiency}/m</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    elements.summaryPanel.innerHTML = `
        <div class="summary-stats">
            <div class="stat-row">
                <span class="stat-label">Total Shelves</span>
                <span class="stat-value">${totalShelves}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Assigned</span>
                <span class="stat-value">${assignedShelves}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Avg Efficiency</span>
                <span class="stat-value">¥${avgEfficiency}/m</span>
            </div>
            ${categoryHtml}
        </div>
    `;
}

function hideCanvasHint() {
    const hint = document.querySelector('.canvas-hint');
    if (hint) hint.style.display = 'none';
}

function showCanvasHint() {
    const hint = document.querySelector('.canvas-hint');
    if (hint) hint.style.display = 'flex';
}

// ==================== Clear & Export ====================
function handleClearAll() {
    if (state.shelves.length === 0) return;
    
    if (confirm('Are you sure you want to clear all shelves?')) {
        document.querySelectorAll('.shelf-item').forEach(el => el.remove());
        state.shelves = [];
        state.efficiencyResults = null;
        state.selectedShelf = null;
        saveToHistory();
        showCanvasHint();
        resetShelfInfoPanel();
        
        elements.summaryPanel.innerHTML = `
            <div class="summary-empty">
                <span class="material-icons">analytics</span>
                <p>Import data and calculate to see results</p>
            </div>
        `;
    }
}

async function handleExport() {
    if (state.shelves.length === 0) {
        alert('No shelves to export.');
        return;
    }

    const exportData = state.shelves.map(shelf => {
        const category = shelf.category ?
            state.categories.find(c => c.id === shelf.category)?.name : 'Unassigned';
        const color = shelf.category ?
            (state.categories.find(c => c.id === shelf.category)?.color || '#9ca3af') : '#9ca3af';
        return {
            'Category': category,
            'Color': color,
            'Length (m)': shelf.length,
            'Turnover (¥)': shelf.turnover || 0,
            'Efficiency (¥/m)': shelf.efficiency || 0
        };
    });

    // Create CSV content
    const headers = Object.keys(exportData[0]);
    const csvContent = [
        headers.join(','),
        ...exportData.map(row => headers.map(h => row[h]).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shelf_efficiency_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

// ==================== Save/Load Layout ====================
function handleSaveLayout() {
    if (state.shelves.length === 0) {
        alert('No shelves to save.');
        return;
    }

    const layoutData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        categories: state.categories,
        shelves: state.shelves.map(shelf => ({
            id: shelf.id,
            type: shelf.type,
            x: shelf.x,
            y: shelf.y,
            length: shelf.length,
            category: shelf.category,
            color: shelf.color
        }))
    };

    const blob = new Blob([JSON.stringify(layoutData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `shelf_layout_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
}

function handleLoadLayout(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const layoutData = JSON.parse(e.target.result);

            if (!layoutData.shelves || !Array.isArray(layoutData.shelves)) {
                throw new Error('Invalid layout file format');
            }

            // Load categories if present
            if (layoutData.categories && Array.isArray(layoutData.categories)) {
                state.categories = layoutData.categories;
                renderCategoryList();
                populateCategorySelect();
            }

            // Clear existing shelves
            document.querySelectorAll('.shelf-item').forEach(el => el.remove());
            state.shelves = [];

            // Load shelves from file
            layoutData.shelves.forEach(shelfData => {
                const shelf = {
                    id: shelfData.id || 'shelf_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                    type: shelfData.type || 'horizontal',
                    x: shelfData.x || 0,
                    y: shelfData.y || 0,
                    length: shelfData.length || SHELF_UNIT_LENGTH,
                    category: shelfData.category || null,
                    color: shelfData.color || null,
                    efficiency: 0,
                    turnover: 0
                };
                state.shelves.push(shelf);
                renderShelf(shelf);
            });

            // Reset history and save initial state
            state.history = [];
            state.historyIndex = -1;
            saveToHistory();

            hideCanvasHint();

            alert(`Loaded ${state.shelves.length} shelves successfully!`);
        } catch (error) {
            console.error('Error loading layout:', error);
            alert('Error loading layout file: ' + error.message);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

// ==================== Zoom Functions ====================
function handleZoom(delta) {
    const newZoom = Math.min(Math.max(state.zoomLevel + delta, 0.25), 3);
    state.zoomLevel = newZoom;
    applyZoom();
}

function resetZoom() {
    state.zoomLevel = 1;
    state.panOffset = { x: 0, y: 0 };
    applyZoom();
}

function applyZoom() {
    const canvas = elements.canvas;
    
    // Apply transform with zoom and pan
    canvas.style.transform = `scale(${state.zoomLevel}) translate(${state.panOffset.x}px, ${state.panOffset.y}px)`;
    canvas.style.transformOrigin = 'top left';

    // Update zoom level display
    elements.zoomLevel.textContent = Math.round(state.zoomLevel * 100) + '%';
}

// ==================== Canvas Panning ====================
function initCanvasPanning() {
    const container = elements.canvas.parentElement;
    
    container.addEventListener('mousedown', (e) => {
        // Only start panning if clicking on the container or canvas background (not on shelves)
        if (e.target === container || e.target.classList.contains('canvas-grid') || e.target === elements.canvas) {
            state.isPanning = true;
            state.panStartX = e.clientX - state.panOffset.x * state.zoomLevel;
            state.panStartY = e.clientY - state.panOffset.y * state.zoomLevel;
            container.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!state.isPanning) return;
        
        state.panOffset.x = (e.clientX - state.panStartX) / state.zoomLevel;
        state.panOffset.y = (e.clientY - state.panStartY) / state.zoomLevel;
        
        applyZoom();
    });
    
    document.addEventListener('mouseup', (e) => {
        if (state.isPanning) {
            state.isPanning = false;
            elements.canvas.parentElement.style.cursor = '';
        }
    });
}

// Make openShelfConfig available globally for onclick
window.openShelfConfig = openShelfConfig;
window.state = state;