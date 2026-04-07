import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Save,
  FolderOpen,
  Trash2,
  ZoomIn,
  ZoomOut,
  Undo,
  Redo,
  Upload,
  Download,
} from 'lucide-react';
import { Magnet } from 'lucide-react';
import ToolPalette from './ToolPalette';
import LayerPanel from './LayerPanel';
import PropertiesPanel from './PropertiesPanel';
import ProjectDialog from './ProjectDialog';
import UnitsSelector from './UnitsSelector';
import ImportExportMenu from './ImportExportMenu';
import { useCADEngine } from '../hooks/useCADEngine';
import { useProjectQueries } from '../hooks/useQueries';
import { useUnits, type UnitType } from '../hooks/useUnits';
import { useImportExport } from '../hooks/useImportExport';

export default function CADCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<'save' | 'load'>('save');

  const { unit, setUnit, convertToPixels, convertFromPixels, getUnitLabel } = useUnits();

  const {
    tool,
    setTool,
    objects,
    selectedObjectIds,
    undo,
    redo,
    canUndo,
    canRedo,
    clearCanvas,
    zoom,
    zoomIn,
    zoomOut,
    pan,
    setPan,
    loadProjectData,
    layers,
    activeLayerId,
    setActiveLayerId,
    addLayer,
    updateLayer,
    deleteLayer,
    toggleLayerVisibility,
    getSelectedObjectData,
    updateObjectProperties,
    commitPropertyChanges,
    mirrorObjects,
    multiCopyObjects,
    snapEnabled,
    toggleSnap,
  } = useCADEngine({
    canvasRef,
    unit,
    convertFromPixels,
    getUnitLabel,
  });

  const { saveProjectMutation, loadProjectMutation } = useProjectQueries();
  const { importDXF, importSVG, exportDXF, exportSVG, exportPDF } = useImportExport(
    objects,
    layers,
    canvasRef
  );

  // Handle canvas resize with larger dimensions
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const container = containerRef.current;
        canvasRef.current.width = Math.max(container.clientWidth, 3000);
        canvasRef.current.height = Math.max(container.clientHeight, 2000);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSaveProject = async (projectName: string) => {
    try {
      const projectId = `project_${Date.now()}`;
      await saveProjectMutation.mutateAsync({
        id: projectId,
        name: projectName,
        objects,
        layers,
        activeLayerId,
        unitSystem: unit,
      });
      toast.success('Project saved successfully!');
      setShowProjectDialog(false);
    } catch (error) {
      toast.error('Failed to save project');
      console.error(error);
    }
  };

  const handleLoadProject = async (projectId: string) => {
    try {
      const project = await loadProjectMutation.mutateAsync(projectId);
      if (project) {
        const backendLayers = project.layers;
        const layersArray = backendLayers ? Array.from(backendLayers.root ? extractLayers(backendLayers) : []) : [];
        
        // Load unit system from project
        if (project.unitSystem) {
          const unitMap: Record<string, UnitType> = {
            'pixels': 'pixels',
            'inches': 'inches',
            'centimeters': 'cm',
          };
          setUnit(unitMap[project.unitSystem] || 'pixels');
        }
        
        loadProjectData(project.objects, layersArray, Number(project.activeLayer));
        toast.success(`Project "${project.name}" loaded successfully!`);
        setShowProjectDialog(false);
      }
    } catch (error) {
      toast.error('Failed to load project');
      console.error(error);
    }
  };

  const extractLayers = (map: any): any[] => {
    const layers: any[] = [];
    const traverse = (node: any) => {
      if (!node || node.__kind__ === 'leaf') return;
      
      if (node.__kind__ === 'red' || node.__kind__ === 'black') {
        const [left, _key, value, right] = node[node.__kind__];
        traverse(left);
        layers.push(value);
        traverse(right);
      }
    };
    traverse(map.root);
    return layers;
  };

  const handleClearCanvas = () => {
    if (objects.length > 0) {
      if (confirm('Are you sure you want to clear the canvas? This cannot be undone.')) {
        clearCanvas();
        toast.success('Canvas cleared');
      }
    }
  };

  const handleImport = async (type: 'dxf' | 'svg') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'dxf' ? '.dxf' : '.svg';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        if (type === 'dxf') {
          const importedObjects = importDXF(text);
          loadProjectData(importedObjects, [], activeLayerId);
          toast.success('DXF file imported successfully!');
        } else {
          const importedObjects = importSVG(text);
          loadProjectData(importedObjects, [], activeLayerId);
          toast.success('SVG file imported successfully!');
        }
      } catch (error) {
        toast.error(`Failed to import ${type.toUpperCase()} file`);
        console.error(error);
      }
    };
    input.click();
  };

  const handleExport = (type: 'dxf' | 'svg' | 'pdf') => {
    try {
      if (type === 'dxf') {
        exportDXF();
        toast.success('DXF file exported successfully!');
      } else if (type === 'svg') {
        exportSVG();
        toast.success('SVG file exported successfully!');
      } else if (type === 'pdf') {
        exportPDF();
        toast.success('PDF file exported successfully!');
      }
    } catch (error) {
      toast.error(`Failed to export ${type.toUpperCase()} file`);
      console.error(error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      {/* Top Toolbar */}
      <div className="border-b border-border/40 bg-card/50 backdrop-blur">
        <div className="container flex items-center gap-2 px-4 py-3">
          <UnitsSelector unit={unit} onUnitChange={setUnit} />

          <Separator orientation="vertical" className="mx-2 h-6" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialogMode('save');
              setShowProjectDialog(true);
            }}
            disabled={objects.length === 0}
          >
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDialogMode('load');
              setShowProjectDialog(true);
            }}
          >
            <FolderOpen className="mr-2 h-4 w-4" />
            Load
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearCanvas}
            disabled={objects.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>

          <Separator orientation="vertical" className="mx-2 h-6" />

          <ImportExportMenu
            onImport={handleImport}
            onExport={handleExport}
            hasObjects={objects.length > 0}
          />

          <Separator orientation="vertical" className="mx-2 h-6" />

          <Button variant="outline" size="sm" onClick={undo} disabled={!canUndo}>
            <Undo className="mr-2 h-4 w-4" />
            Undo
          </Button>
          <Button variant="outline" size="sm" onClick={redo} disabled={!canRedo}>
            <Redo className="mr-2 h-4 w-4" />
            Redo
          </Button>

          <Separator orientation="vertical" className="mx-2 h-6" />

          <Button variant="outline" size="sm" onClick={zoomIn}>
            <ZoomIn className="mr-2 h-4 w-4" />
            Zoom In
          </Button>
          <Button variant="outline" size="sm" onClick={zoomOut}>
            <ZoomOut className="mr-2 h-4 w-4" />
            Zoom Out
          </Button>
          <span className="ml-2 text-sm text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>

          <Separator orientation="vertical" className="mx-2 h-6" />

          <Button
            variant={snapEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={toggleSnap}
          >
            <Magnet className="mr-2 h-4 w-4" />
            Snap {snapEnabled ? 'On' : 'Off'}
          </Button>

          <div className="ml-auto text-sm text-muted-foreground">
            Objects: {objects.length}
            {selectedObjectIds.length > 0 && ` • ${selectedObjectIds.length} selected`}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Tool Palette */}
        <ToolPalette currentTool={tool} onToolChange={setTool} />

        {/* Canvas */}
        <div ref={containerRef} className="relative flex-1 bg-black overflow-auto">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair"
            tabIndex={0}
            style={{ display: 'block' }}
          />
          
          {/* Instructions Overlay */}
          {objects.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rounded-lg border border-border/50 bg-card/80 p-6 text-center backdrop-blur-sm">
                <h3 className="mb-2 text-lg font-semibold">Welcome to CAD Studio</h3>
                <p className="text-sm text-muted-foreground">
                  Select a tool from the left palette and start drawing on the canvas
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use arrow keys to move selected objects • Press Delete to remove selected objects
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pan tool: Drag canvas or use arrow keys/WASD • Snap to key points when enabled
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Measure tool: Click 2 points for distance, 3 points for angle
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Arc Edit tool: Click any edge (line, rectangle, or octagon), then click to define arc center
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Import/Export: Use DXF, SVG, or PDF formats
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Properties Panel */}
        <PropertiesPanel
          selectedObjectData={getSelectedObjectData()}
          onUpdateProperties={updateObjectProperties}
          onCommitChanges={commitPropertyChanges}
          onMirror={mirrorObjects}
          onMultiCopy={multiCopyObjects}
          unit={unit}
          convertFromPixels={convertFromPixels}
        />

        {/* Layer Panel */}
        <LayerPanel
          layers={layers}
          activeLayerId={activeLayerId}
          onActiveLayerChange={setActiveLayerId}
          onAddLayer={addLayer}
          onUpdateLayer={updateLayer}
          onDeleteLayer={deleteLayer}
          onToggleVisibility={toggleLayerVisibility}
        />
      </div>

      {/* Project Dialog */}
      <ProjectDialog
        open={showProjectDialog}
        onOpenChange={setShowProjectDialog}
        mode={dialogMode}
        onSave={handleSaveProject}
        onLoad={handleLoadProject}
      />
    </div>
  );
}

