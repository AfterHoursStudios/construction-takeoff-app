# TakeoffPro - Construction Plan Takeoff Application

A professional web application for construction plan takeoffs, allowing users to upload construction plans, perform scaled measurements, and generate professional PDF reports.

## Features

### Current (MVP - Phase 1)
- **Project Management**: Create, edit, and delete projects with client details
- **PDF Upload & Viewing**: Upload and view multi-page PDF construction plans
- **Per-Page Scale Calibration**: Set accurate scale for each page
- **Linear Measurement Tool**: Measure linear footage for baseboards, framing, gutters, etc.
- **Area Measurement Tool**: Measure square footage for flooring, roofing, siding, etc.
- **Count Tool**: Count items like windows, doors, outlets, fixtures
- **Takeoff Sidebar**: View all measurements grouped by category with live totals
- **PDF Export**: Generate professional takeoff reports with all measurements

### Coming Soon (Phase 2)
- Custom reusable tools
- Waste factors and formulas
- Enhanced PDF export design
- Plan markup screenshots

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Styling**: Tailwind CSS
- **State Management**: Zustand with localStorage persistence
- **PDF Rendering**: PDF.js
- **Drawing/Measurement Layer**: Konva.js / React-Konva
- **PDF Export**: jsPDF with jspdf-autotable
- **Backend**: Node.js + Express + TypeScript
- **File Storage**: Local filesystem (MVP)

## Project Structure

```
construction-takeoff-app/
├── client/                    # React frontend
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── CreateProjectModal.tsx
│   │   │   ├── ExportModal.tsx
│   │   │   ├── MeasurementCanvas.tsx
│   │   │   ├── PdfViewer.tsx
│   │   │   ├── ScaleCalibrationModal.tsx
│   │   │   ├── TakeoffSidebar.tsx
│   │   │   └── ToolConfigModal.tsx
│   │   ├── pages/             # Page components
│   │   │   ├── Dashboard.tsx
│   │   │   └── ProjectView.tsx
│   │   ├── stores/            # Zustand state stores
│   │   │   └── projectStore.ts
│   │   ├── types/             # TypeScript types
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   └── vite.config.ts
├── server/                    # Express backend
│   ├── src/
│   │   └── index.ts
│   ├── uploads/               # PDF storage
│   └── package.json
├── package.json               # Root package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd construction-takeoff-app
```

2. Install all dependencies:
```bash
npm run install:all
```

Or install manually:
```bash
npm install
cd client && npm install
cd ../server && npm install
```

3. Copy the environment example file:
```bash
cp .env.example .env
```

### Running the Application

Start both the client and server in development mode:

```bash
npm run dev
```

Or run them separately:

```bash
# Terminal 1 - Backend
cd server && npm run dev

# Terminal 2 - Frontend
cd client && npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Usage Guide

### 1. Create a Project
1. Click "New Project" on the dashboard
2. Enter project details (name, client, address, notes)
3. Optionally upload a PDF plan
4. Click "Create Project"

### 2. Upload Plans
1. Open your project
2. Click "Choose PDF" or drag and drop a PDF file
3. The PDF will be displayed in the viewer

### 3. Set Page Scale
1. Click the "Set Scale" tool (ruler icon) in the toolbar
2. Click two points on a known dimension (e.g., a wall with a labeled length)
3. Enter the real-world distance
4. The scale will be saved for that page

### 4. Take Measurements

**Linear Measurements:**
1. Select the "Linear" tool
2. Choose or create a tool (e.g., "Baseboard", "Interior Wall")
3. Click points to draw a line/polyline
4. Double-click to complete the measurement

**Area Measurements:**
1. Select the "Area" tool
2. Choose or create a tool (e.g., "LVP Flooring", "Carpet")
3. Click points to draw a polygon
4. Double-click to complete the measurement

**Count Measurements:**
1. Select the "Count" tool
2. Choose or create a tool (e.g., "Windows", "Outlets")
3. Click on items to count them (each click = 1 count)

### 5. View Takeoff Summary
- The right sidebar shows all measurements grouped by category
- Click any item to highlight it on the plan
- Edit, hide, or delete measurements as needed
- Totals update automatically

### 6. Export Report
1. Click "Export PDF" in the top toolbar
2. Enter optional company name and preparer name
3. Select export options
4. Click "Download PDF" to generate the report

## Keyboard Shortcuts

- `Escape` - Cancel current drawing / Deselect
- `Delete` / `Backspace` - Delete selected measurement

## Data Persistence

All project data, measurements, and page scales are automatically saved to your browser's localStorage. Data persists across sessions.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload` | Upload a PDF file |
| GET | `/api/files/:fileId` | Get a PDF file |
| DELETE | `/api/files/:fileId` | Delete a PDF file |
| GET | `/api/health` | Health check |

## Data Model

### Project
```typescript
{
  id: string;
  name: string;
  clientName: string;
  address: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  planFileId?: string;
  planFileName?: string;
}
```

### Measurement
```typescript
{
  id: string;
  projectId: string;
  pageNumber: number;
  toolId: string;
  toolName: string;
  category: string;
  measurementType: 'linear' | 'area' | 'count';
  points: Point[];
  value: number;
  unit: 'LF' | 'SF' | 'EA' | 'CY' | 'SQ';
  color: string;
  wasteFactor: number;
  adjustedValue: number;
  notes: string;
  isVisible: boolean;
  createdAt: string;
}
```

### PageScale
```typescript
{
  id: string;
  projectId: string;
  pageNumber: number;
  pixelsPerUnit: number;
  calibrationPoints: {
    point1: Point;
    point2: Point;
    realWorldDistance: number;
    unit: 'ft' | 'in' | 'm' | 'cm';
  };
}
```

## Building for Production

```bash
# Build the client
npm run build

# The built files will be in client/dist/
```

## License

MIT License
