import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Eye,
  EyeOff,
  FolderOpen,
  Redo,
  Save,
  Trash2,
  Undo,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Magnet } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCADEngine } from "../hooks/useCADEngine";
import { useImportExport } from "../hooks/useImportExport";
import { useProjectQueries } from "../hooks/useQueries";
import { type UnitType, useUnits } from "../hooks/useUnits";
import ImportExportMenu from "./ImportExportMenu";
import type { ExportType, ImportType } from "./ImportExportMenu";
import LayerPanel from "./LayerPanel";
import ProjectDialog from "./ProjectDialog";
import PropertiesPanel from "./PropertiesPanel";
import ToolPalette from "./ToolPalette";
import UnitsSelector from "./UnitsSelector";

interface PdfBackground {
  dataUrl: string;
  visible: boolean;
}

export default function CADCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showProjectDialog, setShowProjectDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState<"save" | "load">("save");
  const [pdfBackground, setPdfBackground] = useState<PdfBackground | null>(
    null,
  );

  const { unit, setUnit, convertFromPixels, getUnitLabel } = useUnits();

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
  const {
    importDXF,
    importDWG,
    importSVG,
    importPDFAsBackground,
    exportDXF,
    exportDWG,
    exportSVG,
    exportPDF,
  } = useImportExport(objects, layers, canvasRef);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const container = containerRef.current;
        canvasRef.current.width = Math.max(container.clientWidth, 3000);
        canvasRef.current.height = Math.max(container.clientHeight, 2000);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSaveProject = async (projectName: string) => {
    try {
      const projectId = `project_${Date.now()}`;
      await saveProjectMutation.mutateAsync({
        id: projectId,
        name: projectName,
        objects,
        activeLayerId,
        unitSystem: unit,
      });
      toast.success("Project saved successfully!");
      setShowProjectDialog(false);
    } catch (error) {
      toast.error("Failed to save project");
      console.error(error);
    }
  };

  const handleLoadProject = async (projectId: string) => {
    try {
      const project = await loadProjectMutation.mutateAsync(projectId);
      if (project) {
        // layers is Array<[bigint, Layer]> — extract the Layer objects
        const layersArray = (project.layers ?? []).map(([, layer]) => layer);

        if (project.unitSystem) {
          const unitMap: Record<string, UnitType> = {
            pixels: "pixels",
            inches: "inches",
            centimeters: "cm",
          };
          setUnit(unitMap[String(project.unitSystem)] || "pixels");
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        loadProjectData(
          project.objects as any[],
          layersArray as any[],
          Number(project.activeLayer),
        );
        toast.success(`Project "${project.name}" loaded successfully!`);
        setShowProjectDialog(false);
      }
    } catch (error) {
      toast.error("Failed to load project");
      console.error(error);
    }
  };

  const handleClearCanvas = () => {
    if (objects.length > 0) {
      if (
        confirm(
          "Are you sure you want to clear the canvas? This cannot be undone.",
        )
      ) {
        clearCanvas();
        toast.success("Canvas cleared");
      }
    }
  };

  const handleImport = useCallback(
    async (type: ImportType) => {
      const input = document.createElement("input");
      input.type = "file";

      const acceptMap: Record<ImportType, string> = {
        dxf: ".dxf",
        dwg: ".dwg,.dxf",
        svg: ".svg",
        pdf: ".pdf",
      };
      input.accept = acceptMap[type];

      return new Promise<void>((resolve) => {
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            resolve();
            return;
          }

          try {
            if (type === "pdf") {
              const dataUrl = await importPDFAsBackground(file);
              setPdfBackground({ dataUrl, visible: true });
              toast.success("PDF imported as background — draw over it!");
            } else if (type === "dxf") {
              const text = await file.text();
              const result = importDXF(text);
              // Create new layers for imported layer names
              const layerIdMap = new Map<number, number>();
              layerIdMap.set(0, activeLayerId);
              for (let i = 0; i < result.newLayers.length; i++) {
                const nl = result.newLayers[i];
                addLayer(nl.name, nl.color);
                layerIdMap.set(i + 1, layers.length + i);
              }
              loadProjectData(result.objects, [], activeLayerId);
              const msg =
                result.newLayers.length > 0
                  ? `DXF imported: ${result.objects.length} objects, ${result.newLayers.length} new layers`
                  : `DXF imported: ${result.objects.length} objects`;
              toast.success(msg);
            } else if (type === "dwg") {
              const text = await file.text();
              const result = importDWG(text);
              for (const nl of result.newLayers) {
                addLayer(nl.name, nl.color);
              }
              loadProjectData(result.objects, [], activeLayerId);
              const msg =
                result.newLayers.length > 0
                  ? `DWG imported: ${result.objects.length} objects, ${result.newLayers.length} layers created`
                  : `DWG imported: ${result.objects.length} objects`;
              toast.success(msg);
            } else {
              const text = await file.text();
              const importedObjects = importSVG(text);
              loadProjectData(importedObjects, [], activeLayerId);
              toast.success(`SVG imported: ${importedObjects.length} objects`);
            }
          } catch (error) {
            if (type === "dwg") {
              toast.error(
                "Could not parse DWG file. Try converting to DXF format first.",
              );
            } else {
              toast.error(`Failed to import ${type.toUpperCase()} file`);
            }
            console.error(error);
          }
          resolve();
        };
        input.click();
      });
    },
    [
      importDXF,
      importDWG,
      importSVG,
      importPDFAsBackground,
      loadProjectData,
      addLayer,
      layers.length,
      activeLayerId,
    ],
  );

  const handleExport = useCallback(
    async (type: ExportType) => {
      try {
        if (type === "dxf") {
          exportDXF();
          toast.success("DXF exported successfully!");
        } else if (type === "dwg") {
          exportDWG();
          toast.success("DWG exported successfully!");
        } else if (type === "svg") {
          exportSVG();
          toast.success("SVG exported successfully!");
        } else if (type === "pdf") {
          exportPDF();
          toast.success("PDF exported successfully!");
        }
      } catch (error) {
        toast.error(`Failed to export ${type.toUpperCase()} file`);
        console.error(error);
      }
    },
    [exportDXF, exportDWG, exportSVG, exportPDF],
  );

  const togglePdfBackground = () => {
    setPdfBackground((prev) =>
      prev ? { ...prev, visible: !prev.visible } : null,
    );
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
              setDialogMode("save");
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
              setDialogMode("load");
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

          {pdfBackground && (
            <>
              <Separator orientation="vertical" className="mx-2 h-6" />
              <Button
                variant={pdfBackground.visible ? "default" : "outline"}
                size="sm"
                onClick={togglePdfBackground}
                data-ocid="toggle-pdf-background"
              >
                {pdfBackground.visible ? (
                  <Eye className="mr-2 h-4 w-4" />
                ) : (
                  <EyeOff className="mr-2 h-4 w-4" />
                )}
                PDF BG
              </Button>
            </>
          )}

          <Separator orientation="vertical" className="mx-2 h-6" />

          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo}
          >
            <Undo className="mr-2 h-4 w-4" />
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!canRedo}
          >
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
            variant={snapEnabled ? "default" : "outline"}
            size="sm"
            onClick={toggleSnap}
          >
            <Magnet className="mr-2 h-4 w-4" />
            Snap {snapEnabled ? "On" : "Off"}
          </Button>

          <div className="ml-auto text-sm text-muted-foreground">
            Objects: {objects.length}
            {selectedObjectIds.length > 0 &&
              ` • ${selectedObjectIds.length} selected`}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex flex-1 overflow-hidden">
        <ToolPalette currentTool={tool} onToolChange={setTool} />

        {/* Canvas + PDF background overlay */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-black overflow-auto"
        >
          {/* PDF background image (rendered behind canvas) */}
          {pdfBackground?.visible && pdfBackground.dataUrl && (
            <img
              src={pdfBackground.dataUrl}
              alt="PDF background"
              className="pointer-events-none absolute inset-0 h-full w-full object-contain"
              style={{ opacity: 0.4, zIndex: 0 }}
            />
          )}

          <canvas
            ref={canvasRef}
            className="cursor-crosshair"
            tabIndex={0}
            style={{
              display: "block",
              position: "relative",
              zIndex: 1,
              background: "transparent",
            }}
          />

          {objects.length === 0 && !pdfBackground && (
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
              style={{ zIndex: 2 }}
            >
              <div className="rounded-lg border border-border/50 bg-card/80 p-6 text-center backdrop-blur-sm">
                <h3 className="mb-2 text-lg font-semibold">
                  Welcome to CAD Studio
                </h3>
                <p className="text-sm text-muted-foreground">
                  Select a tool from the left palette and start drawing on the
                  canvas
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Use arrow keys to move selected objects • Press Delete to
                  remove selected objects
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pan tool: Drag canvas or use arrow keys/WASD • Snap to key
                  points when enabled
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Measure tool: Click 2 points for distance, 3 points for angle
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Import: DXF, DWG (layers auto-created), SVG, PDF (traceable
                  background)
                </p>
              </div>
            </div>
          )}
        </div>

        <PropertiesPanel
          selectedObjectData={getSelectedObjectData()}
          onUpdateProperties={updateObjectProperties}
          onCommitChanges={commitPropertyChanges}
          onMirror={mirrorObjects}
          onMultiCopy={multiCopyObjects}
          unit={unit}
          convertFromPixels={convertFromPixels}
        />

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
