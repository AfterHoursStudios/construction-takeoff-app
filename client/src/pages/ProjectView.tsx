import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Upload,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  ChevronLeft,
  ChevronRight,
  Ruler,
  Square,
  MousePointer,
  Hand,
  Hash,
  MessageSquare,
  Minus,
  Package,
  Settings,
} from 'lucide-react';
import { useProjectStore } from '../stores/projectStore';
import { useAuthStore } from '../stores/authStore';
import { uploadFile, supabase, BUCKET_NAME } from '../lib/supabase';
import headerLogo from '../assets/headerlogo.png';
import PdfViewer from '../components/PdfViewer';
import MeasurementCanvas from '../components/MeasurementCanvas';
import TakeoffSidebar from '../components/TakeoffSidebar';
import ColorPickerModal from '../components/ColorPickerModal';
import MeasurementNameModal from '../components/MeasurementNameModal';
import ScaleCalibrationModal from '../components/ScaleCalibrationModal';
import ExportModal from '../components/ExportModal';
import NoteInputModal from '../components/NoteInputModal';
import ToolPresetsModal from '../components/ToolPresetsModal';
import SavedMaterialsModal from '../components/SavedMaterialsModal';
import EditProjectModal from '../components/EditProjectModal';
import type { ActiveTool } from '../types';

export default function ProjectView() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);

  const {
    projects,
    currentProject,
    setCurrentProject,
    currentPage,
    setCurrentPage,
    totalPages,
    setTotalPages,
    activeTool,
    setActiveTool,
    viewportScale,
    setViewportScale,
    updateProject,
    pageScales,
    getPageName,
    setPageName,
    pendingNotePosition,
    snapToAngle,
    setSnapToAngle,
    pendingMeasurement,
    setPendingMeasurement,
    toolPresets,
    activeToolPreset,
    useToolPreset,
    setActiveToolPreset,
    setContinuingMeasurementName,
    quickDrawMode,
    toggleQuickDrawMode,
    isDataLoaded,
    loadUserData,
  } = useProjectStore();
  const { user } = useAuthStore();

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showToolPresetsModal, setShowToolPresetsModal] = useState(false);
  const [showSavedMaterialsModal, setShowSavedMaterialsModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [pdfDimensions, setPdfDimensions] = useState({ width: 0, height: 0 });
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isEditingPageName, setIsEditingPageName] = useState(false);
  const [editingPageName, setEditingPageName] = useState('');
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [spacePressed, setSpacePressed] = useState(false);

  // Load user data if not already loaded (direct navigation to project)
  useEffect(() => {
    if (user && !isDataLoaded) {
      loadUserData(user.id);
    }
  }, [user, isDataLoaded, loadUserData]);

  // Load project on mount
  useEffect(() => {
    if (projectId && isDataLoaded) {
      const project = projects.find((p) => p.id === projectId);
      if (project) {
        setCurrentProject(project);
        if (project.planFileId) {
          const { data } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(`${project.planFileId}.pdf`);
          setPdfUrl(data.publicUrl);
        }
      } else {
        navigate('/dashboard');
      }
    }
  }, [projectId, projects, setCurrentProject, navigate, isDataLoaded]);

  // Handle PDF file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentProject) return;

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    setIsUploadingPdf(true);
    try {
      const result = await uploadFile(file);
      updateProject(currentProject.id, {
        planFileId: result.fileId,
        planFileName: file.name,
      });
      setPdfUrl(result.fileUrl);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload PDF. Please try again.');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const handleZoom = (delta: number) => {
    const newScale = Math.max(0.25, Math.min(4, viewportScale + delta));
    setViewportScale(newScale);
  };

  // Mouse wheel zoom with native event listener for proper preventDefault
  useEffect(() => {
    const container = viewerContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.25, Math.min(4, viewportScale + delta));
      setViewportScale(newScale);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [viewportScale, setViewportScale]);

  // Space key for temporary pan mode and tool hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isFormField = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.tagName === 'SELECT' ||
                          target.isContentEditable;

      if (isFormField) return;

      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        setSpacePressed(true);
      }

      // Hotkey: D - Toggle line mode (two-click straight line)
      if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        toggleQuickDrawMode('line');
      }

      // Hotkey: S - Toggle rectangle/square mode
      if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        toggleQuickDrawMode('rectangle');
      }

      // Hotkey: A - Toggle angle snap
      if (e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        setSnapToAngle(!snapToAngle);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
        setIsPanning(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [snapToAngle, setSnapToAngle, toggleQuickDrawMode]);

  // Panning handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || spacePressed || activeTool === 'pan') {
      e.preventDefault();
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !viewerContainerRef.current) return;

    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;

    viewerContainerRef.current.scrollLeft -= dx;
    viewerContainerRef.current.scrollTop -= dy;

    setPanStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetZoom = () => {
    setViewportScale(1);
  };

  const handleToolSelect = (tool: ActiveTool) => {
    // Clear any active preset and continuing name when manually selecting a tool
    setActiveToolPreset(null);
    setContinuingMeasurementName(null);

    // Show color picker for measurement tools and line tool
    if (tool === 'linear' || tool === 'area' || tool === 'count' || tool === 'line') {
      setShowColorPicker(true);
    }
    setActiveTool(tool);
  };

  const currentPageScale = projectId
    ? pageScales[`${projectId}-${currentPage}`]
    : null;

  // Custom line icon with dots on each end
  const LinearIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="20" x2="20" y2="4" />
      <circle cx="4" cy="20" r="2" fill="currentColor" />
      <circle cx="20" cy="4" r="2" fill="currentColor" />
    </svg>
  );

  // Quick measure icon
  const MeasureIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="8" x2="3" y2="16" />
      <line x1="21" y1="8" x2="21" y2="16" />
      <line x1="7" y1="10" x2="7" y2="14" />
      <line x1="12" y1="9" x2="12" y2="15" />
      <line x1="17" y1="10" x2="17" y2="14" />
    </svg>
  );

  // Two-click line mode icon (line with two dots)
  const LineModeIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="4" cy="12" r="2" fill="currentColor" />
      <circle cx="20" cy="12" r="2" fill="currentColor" />
    </svg>
  );

  // Rectangle mode icon (outlined rectangle)
  const RectangleModeIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="1" />
    </svg>
  );

  const tools: { id: ActiveTool; icon: React.ReactNode; label: string }[] = [
    { id: 'select', icon: <MousePointer className="w-5 h-5" />, label: 'Select' },
    { id: 'pan', icon: <Hand className="w-5 h-5" />, label: 'Pan' },
    { id: 'scale', icon: <Ruler className="w-5 h-5" />, label: 'Set Scale' },
    { id: 'measure', icon: <MeasureIcon />, label: 'Quick Measure' },
    { id: 'line', icon: <Minus className="w-5 h-5" />, label: 'Line' },
    { id: 'linear', icon: <LinearIcon />, label: 'Linear' },
    { id: 'area', icon: <Square className="w-5 h-5" />, label: 'Area' },
    { id: 'count', icon: <Hash className="w-5 h-5" />, label: 'Count' },
    { id: 'note', icon: <MessageSquare className="w-5 h-5" />, label: 'Note' },
  ];

  if (!currentProject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <img src={headerLogo} alt="TakeoffPro" className="h-16 w-auto" />
          <button
            onClick={() => setShowEditProjectModal(true)}
            className="border-l border-slate-200 pl-4 text-left hover:bg-slate-50 rounded-r-lg pr-3 py-1 transition-colors"
            title="Click to edit project info"
          >
            <h1 className="font-semibold text-slate-800">{currentProject.name}</h1>
            <p className="text-sm text-slate-500">{currentProject.clientName || 'Click to add client'}</p>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Scale indicator */}
          {currentPageScale && (
            <button
              onClick={() => setShowScaleModal(true)}
              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
              title="Click to change scale"
            >
              Scale: {(1 / currentPageScale.pixelsPerUnit * 12).toFixed(2)}" = 1'
            </button>
          )}

          {!currentPageScale && pdfUrl && (
            <button
              onClick={() => setShowScaleModal(true)}
              className="px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-200 transition-colors"
            >
              Scale not set - Click to set
            </button>
          )}

          <button
            onClick={() => setShowExportModal(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() => handleToolSelect(tool.id)}
              className={`tool-btn ${activeTool === tool.id ? 'active' : ''}`}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
          <div className="w-px h-6 bg-slate-300 mx-2" />
          {/* Quick Draw Modes */}
          <button
            onClick={() => toggleQuickDrawMode('line')}
            className={`tool-btn flex flex-col items-center gap-0.5 py-1 ${quickDrawMode === 'line' ? 'active' : ''}`}
            title="Line Mode [D] - Two-click straight line"
          >
            <LineModeIcon />
            <span className="text-[9px] font-medium opacity-60">D</span>
          </button>
          <button
            onClick={() => toggleQuickDrawMode('rectangle')}
            className={`tool-btn flex flex-col items-center gap-0.5 py-1 ${quickDrawMode === 'rectangle' ? 'active' : ''}`}
            title="Square Mode [S] - Click and drag"
          >
            <RectangleModeIcon />
            <span className="text-[9px] font-medium opacity-60">S</span>
          </button>
          <div className="w-px h-6 bg-slate-300 mx-2" />
          <button
            onClick={() => setSnapToAngle(!snapToAngle)}
            className={`tool-btn flex flex-col items-center gap-0.5 py-1 ${snapToAngle ? 'active' : ''}`}
            title="Snap to 45°/90° angles [A]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 20h16" />
              <path d="M4 20v-8" />
              <path d="M4 12l8-8" />
              <circle cx="12" cy="4" r="2" fill="currentColor" />
            </svg>
            <span className="text-[9px] font-medium opacity-60">A</span>
          </button>
          <div className="w-px h-6 bg-slate-300 mx-2" />
          {/* Tool Presets */}
          <div className="relative">
            <button
              onClick={() => setShowPresetPicker(!showPresetPicker)}
              className={`tool-btn flex items-center gap-1 px-2 ${activeToolPreset ? 'active' : ''}`}
              title="Tool Presets"
            >
              <Package className="w-5 h-5" />
              {activeToolPreset && (
                <span className="text-xs font-medium truncate max-w-20">{activeToolPreset.name}</span>
              )}
            </button>
            {showPresetPicker && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
                <div className="p-2 border-b border-slate-100">
                  <div className="text-xs font-medium text-slate-500 px-2 py-1">Tool Presets</div>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {toolPresets.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">No presets yet</p>
                  ) : (
                    <div className="space-y-1">
                      {activeToolPreset && (
                        <button
                          onClick={() => {
                            setActiveToolPreset(null);
                            setShowPresetPicker(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 rounded flex items-center gap-2"
                        >
                          <span className="text-slate-400">Clear active preset</span>
                        </button>
                      )}
                      {toolPresets.map((preset) => (
                        <button
                          key={preset.id}
                          onClick={() => {
                            useToolPreset(preset);
                            setShowPresetPicker(false);
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-slate-100 rounded flex items-center gap-3 ${
                            activeToolPreset?.id === preset.id ? 'bg-primary-50' : ''
                          }`}
                        >
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: preset.color + '20', color: preset.color }}
                          >
                            {preset.measurementType === 'linear' && <Ruler className="w-3 h-3" />}
                            {preset.measurementType === 'area' && <Square className="w-3 h-3" />}
                            {preset.measurementType === 'count' && <Hash className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-700 truncate">{preset.name}</div>
                            <div className="text-xs text-slate-400">
                              {preset.materials.length} material{preset.materials.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowPresetPicker(false);
                      setShowToolPresetsModal(true);
                    }}
                    className="w-full px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4" />
                    Manage Presets
                  </button>
                  <button
                    onClick={() => {
                      setShowPresetPicker(false);
                      setShowSavedMaterialsModal(true);
                    }}
                    className="w-full px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded flex items-center justify-center gap-2"
                  >
                    <Package className="w-4 h-4" />
                    Manage Materials
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Page navigation */}
          {pdfUrl && totalPages > 0 && (
            <div className="flex items-center gap-2 mr-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex flex-col items-center">
                {isEditingPageName ? (
                  <input
                    type="text"
                    value={editingPageName}
                    onChange={(e) => setEditingPageName(e.target.value)}
                    onBlur={() => {
                      if (projectId && editingPageName.trim()) {
                        setPageName(projectId, currentPage, editingPageName.trim());
                      }
                      setIsEditingPageName(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (projectId && editingPageName.trim()) {
                          setPageName(projectId, currentPage, editingPageName.trim());
                        }
                        setIsEditingPageName(false);
                      }
                      if (e.key === 'Escape') setIsEditingPageName(false);
                    }}
                    className="text-sm font-medium text-center border border-primary-300 rounded px-2 py-0.5 w-32"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={() => {
                      setEditingPageName(projectId ? getPageName(projectId, currentPage) : `Page ${currentPage}`);
                      setIsEditingPageName(true);
                    }}
                    className="text-sm font-medium text-slate-700 hover:text-primary-600 hover:underline"
                    title="Click to rename page"
                  >
                    {projectId ? getPageName(projectId, currentPage) : `Page ${currentPage}`}
                  </button>
                )}
                <span className="text-xs text-slate-400">{currentPage} of {totalPages}</span>
              </div>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="p-2 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Zoom controls */}
          <button
            onClick={() => handleZoom(-0.25)}
            className="p-2 hover:bg-slate-100 rounded-lg"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium text-slate-600 min-w-[60px] text-center">
            {Math.round(viewportScale * 100)}%
          </span>
          <button
            onClick={() => handleZoom(0.25)}
            className="p-2 hover:bg-slate-100 rounded-lg"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 hover:bg-slate-100 rounded-lg"
            title="Reset Zoom"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Page List Sidebar */}
        {pdfUrl && totalPages > 0 && (
          <div className="w-48 bg-white border-r border-slate-200 overflow-y-auto shrink-0">
            <div className="p-3 border-b border-slate-200 bg-slate-50">
              <h3 className="text-sm font-semibold text-slate-700">Pages</h3>
            </div>
            <div className="p-2 space-y-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    currentPage === pageNum
                      ? 'bg-primary-100 text-primary-700 font-medium'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  <span className="text-xs text-slate-400 mr-2">{pageNum}.</span>
                  {projectId ? getPageName(projectId, pageNum) : `Page ${pageNum}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PDF Viewer / Upload Area */}
        <div
          ref={viewerContainerRef}
          className="flex-1 relative overflow-auto bg-slate-200"
          style={{
            cursor: isPanning ? 'grabbing' : (spacePressed || activeTool === 'pan') ? 'grab' : 'default',
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {pdfUrl ? (
            <div
              className="inline-block p-4"
              style={{
                minWidth: '100%',
                minHeight: '100%',
              }}
            >
              <div
                style={{
                  width: pdfDimensions.width * viewportScale,
                  height: pdfDimensions.height * viewportScale,
                  margin: '0 auto',
                }}
              >
                <div
                  className="relative"
                  style={{
                    transform: `scale(${viewportScale})`,
                    transformOrigin: 'top left',
                  }}
                >
                  <PdfViewer
                    url={pdfUrl}
                    page={currentPage}
                    onPageCountChange={setTotalPages}
                    onDimensionsChange={setPdfDimensions}
                  />
                  <MeasurementCanvas
                    width={pdfDimensions.width}
                    height={pdfDimensions.height}
                    onScaleCalibrationComplete={() => setShowScaleModal(true)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="card text-center py-16 px-12 cursor-pointer hover:shadow-md transition-shadow"
              >
                <Upload className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-slate-600 mb-2">
                  Upload Plan PDF
                </h2>
                <p className="text-slate-500 mb-6">
                  Drop a PDF file here or click to browse
                </p>
                <button className="btn btn-primary">
                  {isUploadingPdf ? 'Uploading...' : 'Choose PDF'}
                </button>
              </div>
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Right Sidebar - Takeoff Items */}
        <TakeoffSidebar />
      </div>

      {/* Modals */}
      {showColorPicker && (
        <ColorPickerModal onClose={() => setShowColorPicker(false)} />
      )}

      {pendingMeasurement && (
        <MeasurementNameModal onClose={() => setPendingMeasurement(null)} />
      )}

      {showScaleModal && (
        <ScaleCalibrationModal onClose={() => setShowScaleModal(false)} />
      )}

      {showExportModal && (
        <ExportModal onClose={() => setShowExportModal(false)} />
      )}

      {showToolPresetsModal && (
        <ToolPresetsModal onClose={() => setShowToolPresetsModal(false)} />
      )}

      {showSavedMaterialsModal && (
        <SavedMaterialsModal onClose={() => setShowSavedMaterialsModal(false)} />
      )}

      {showEditProjectModal && currentProject && (
        <EditProjectModal project={currentProject} onClose={() => setShowEditProjectModal(false)} />
      )}

      {pendingNotePosition && (
        <NoteInputModal onClose={() => {}} />
      )}
    </div>
  );
}
