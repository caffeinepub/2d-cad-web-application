import { jsPDF } from "jspdf";
import * as pdfjsLib from "pdfjs-dist";
import type { RefObject } from "react";
import type { DrawingObject } from "../types/cad";
import { Color } from "../types/cad";

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

interface LayerState {
  id: number;
  name: string;
  color: string;
  visible: boolean;
}

export interface ImportResult {
  objects: DrawingObject[];
  newLayers: Array<{ name: string; color: string }>;
}

interface DXFGroup {
  code: number;
  value: string;
}

// DXF color index → app Color + hex
const DXF_COLOR_ENTRIES: Array<[number, Color, string]> = [
  [1, Color.red, "#ff0000"],
  [2, Color.yellow, "#ffff00"],
  [3, Color.green, "#00ff00"],
  [5, Color.blue, "#0000ff"],
  [7, Color.white, "#ffffff"],
];

function dxfColorToApp(colorIndex: number): Color {
  for (const [idx, color] of DXF_COLOR_ENTRIES) {
    if (idx === colorIndex) return color;
  }
  return Color.white;
}

function dxfColorToHex(colorIndex: number): string {
  for (const [idx, , hex] of DXF_COLOR_ENTRIES) {
    if (idx === colorIndex) return hex;
  }
  return "#ffffff";
}

function hexToDXFIndex(hex: string): number {
  const entries: Array<[string, number]> = [
    ["#ff0000", 1],
    ["#ffff00", 2],
    ["#00ff00", 3],
    ["#0000ff", 5],
    ["#ffffff", 7],
  ];
  const lower = hex.toLowerCase();
  for (const [h, idx] of entries) {
    if (h === lower) return idx;
  }
  return 7;
}

function colorToDXFIndex(color: Color): number {
  const map: Array<[Color, number]> = [
    [Color.red, 1],
    [Color.yellow, 2],
    [Color.green, 3],
    [Color.blue, 5],
    [Color.white, 7],
    [Color.none, 0],
  ];
  for (const [c, idx] of map) {
    if (c === color) return idx;
  }
  return 7;
}

// Parse DXF/DWG text content into group code pairs
function parseDXFGroups(content: string): DXFGroup[] {
  const lines = content.split(/\r?\n/);
  const groups: DXFGroup[] = [];
  for (let i = 0; i < lines.length - 1; i += 2) {
    const code = Number.parseInt(lines[i].trim(), 10);
    const value = lines[i + 1]?.trim() ?? "";
    if (!Number.isNaN(code)) {
      groups.push({ code, value });
    }
  }
  return groups;
}

// Parse TABLES section to extract layer definitions
function parseLayersFromDXF(groups: DXFGroup[]): Map<string, string> {
  const layerColorMap = new Map<string, string>();
  let inTables = false;
  let inLayerEntry = false;
  let currentLayerName = "";
  let currentColorIndex = 7;

  for (const { code, value } of groups) {
    if (code === 2 && value === "TABLES") {
      inTables = true;
      continue;
    }
    if (code === 0 && value === "ENDSEC") {
      if (inTables) inTables = false;
      continue;
    }
    if (!inTables) continue;

    if (code === 0 && value === "LAYER") {
      if (inLayerEntry && currentLayerName) {
        layerColorMap.set(currentLayerName, dxfColorToHex(currentColorIndex));
      }
      inLayerEntry = true;
      currentLayerName = "";
      currentColorIndex = 7;
    } else if (inLayerEntry) {
      if (code === 2) currentLayerName = value;
      if (code === 62) currentColorIndex = Math.abs(Number.parseInt(value, 10));
    }
  }
  if (inLayerEntry && currentLayerName) {
    layerColorMap.set(currentLayerName, dxfColorToHex(currentColorIndex));
  }
  return layerColorMap;
}

// Parse ENTITIES section
function parseEntitiesFromDXF(
  groups: DXFGroup[],
  layerNameToId: Map<string, number>,
): DrawingObject[] {
  const SUPPORTED = new Set([
    "LINE",
    "CIRCLE",
    "ARC",
    "LWPOLYLINE",
    "POLYLINE",
    "ELLIPSE",
  ]);
  const objects: DrawingObject[] = [];
  let inEntities = false;
  let entityStart = -1;
  let currentEntity = "";

  for (let i = 0; i < groups.length; i++) {
    const { code, value } = groups[i];

    if (code === 2 && value === "ENTITIES") {
      inEntities = true;
      continue;
    }
    if (code === 0 && value === "ENDSEC" && inEntities) {
      if (currentEntity && entityStart >= 0) {
        const obj = parseEntity(
          currentEntity,
          groups.slice(entityStart, i),
          layerNameToId,
        );
        if (obj) objects.push(obj);
      }
      inEntities = false;
      break;
    }
    if (!inEntities) continue;

    if (code === 0 && SUPPORTED.has(value)) {
      if (currentEntity && entityStart >= 0) {
        const obj = parseEntity(
          currentEntity,
          groups.slice(entityStart, i),
          layerNameToId,
        );
        if (obj) objects.push(obj);
      }
      currentEntity = value;
      entityStart = i;
    } else if (
      code === 0 &&
      currentEntity &&
      entityStart >= 0 &&
      !SUPPORTED.has(value)
    ) {
      const obj = parseEntity(
        currentEntity,
        groups.slice(entityStart, i),
        layerNameToId,
      );
      if (obj) objects.push(obj);
      currentEntity = "";
      entityStart = -1;
    }
  }

  return objects;
}

function parseEntity(
  type: string,
  groups: DXFGroup[],
  layerNameToId: Map<string, number>,
): DrawingObject | null {
  let layerName = "0";
  let colorIndex = 7;
  const vals: Record<number, string> = {};

  for (const { code, value } of groups) {
    if (code === 8) layerName = value;
    if (code === 62) colorIndex = Math.abs(Number.parseInt(value, 10));
    vals[code] = value;
  }

  const layerId = BigInt(layerNameToId.get(layerName) ?? 0);
  const color = dxfColorToApp(colorIndex);

  if (type === "LINE") {
    return {
      __kind__: "line",
      line: {
        line: {
          start: {
            x: Number.parseFloat(vals[10] ?? "0"),
            y: Number.parseFloat(vals[20] ?? "0"),
          },
          end: {
            x: Number.parseFloat(vals[11] ?? "0"),
            y: Number.parseFloat(vals[21] ?? "0"),
          },
        },
        color,
        rotation: 0,
        layer: layerId,
      },
    };
  }

  if (type === "CIRCLE") {
    return {
      __kind__: "circle",
      circle: {
        circle: {
          center: {
            x: Number.parseFloat(vals[10] ?? "0"),
            y: Number.parseFloat(vals[20] ?? "0"),
          },
          radius: Number.parseFloat(vals[40] ?? "10"),
        },
        color,
        rotation: 0,
        layer: layerId,
        fill: Color.none,
      },
    };
  }

  if (type === "ARC") {
    return {
      __kind__: "arc",
      arc: {
        arc: {
          center: {
            x: Number.parseFloat(vals[10] ?? "0"),
            y: Number.parseFloat(vals[20] ?? "0"),
          },
          radius: Number.parseFloat(vals[40] ?? "10"),
          startAngle: (Number.parseFloat(vals[50] ?? "0") * Math.PI) / 180,
          endAngle: (Number.parseFloat(vals[51] ?? "90") * Math.PI) / 180,
        },
        color,
        rotation: 0,
        layer: layerId,
      },
    };
  }

  if (type === "ELLIPSE") {
    const cx = Number.parseFloat(vals[10] ?? "0");
    const cy = Number.parseFloat(vals[20] ?? "0");
    const majorX = Number.parseFloat(vals[11] ?? "10");
    const majorY = Number.parseFloat(vals[21] ?? "0");
    const ratio = Number.parseFloat(vals[40] ?? "0.5");
    const majorR = Math.sqrt(majorX * majorX + majorY * majorY);
    return {
      __kind__: "ellipse",
      ellipse: {
        ellipse: {
          center: { x: cx, y: cy },
          radiusX: majorR,
          radiusY: majorR * ratio,
        },
        color,
        rotation: 0,
        layer: layerId,
        fill: Color.none,
      },
    };
  }

  return null;
}

// Helper: download blob
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper: parse DXF text content into ImportResult
function parseDXFTextContent(content: string): ImportResult {
  const groups = parseDXFGroups(content);
  const dxfLayerColors = parseLayersFromDXF(groups);

  const newLayers: Array<{ name: string; color: string }> = [];
  const layerNameToId = new Map<string, number>();
  layerNameToId.set("0", 0);

  let nextId = 1;
  for (const [name, hexColor] of dxfLayerColors.entries()) {
    if (name !== "0") {
      layerNameToId.set(name, nextId);
      newLayers.push({ name, color: hexColor });
      nextId++;
    }
  }

  const importedObjects = parseEntitiesFromDXF(groups, layerNameToId);
  return { objects: importedObjects, newLayers };
}

// Build DXF export string with full layer + color support
function buildDXFString(
  objects: DrawingObject[],
  layers: LayerState[],
): string {
  let dxf = "0\nSECTION\n2\nHEADER\n0\nENDSEC\n";
  dxf += "0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n";

  for (const layer of layers) {
    const colorIndex = hexToDXFIndex(layer.color || "#ffffff");
    dxf += `0\nLAYER\n2\n${layer.name}\n70\n0\n62\n${colorIndex}\n6\nCONTINUOUS\n`;
  }

  dxf += "0\nENDTAB\n0\nENDSEC\n";
  dxf += "0\nSECTION\n2\nENTITIES\n";

  for (const obj of objects) {
    const layerId = Number(getObjectLayerStatic(obj));
    const layer = layers.find((l) => l.id === layerId);
    const layerName = layer?.name ?? "0";
    const colorIdx = colorToDXFIndex(getObjectColorStatic(obj));

    if (obj.__kind__ === "line") {
      const { start, end } = obj.line.line;
      dxf += `0\nLINE\n8\n${layerName}\n62\n${colorIdx}\n10\n${start.x}\n20\n${start.y}\n11\n${end.x}\n21\n${end.y}\n`;
    } else if (obj.__kind__ === "circle") {
      const { center, radius } = obj.circle.circle;
      dxf += `0\nCIRCLE\n8\n${layerName}\n62\n${colorIdx}\n10\n${center.x}\n20\n${center.y}\n40\n${radius}\n`;
    } else if (obj.__kind__ === "arc") {
      const { center, radius, startAngle, endAngle } = obj.arc.arc;
      dxf += `0\nARC\n8\n${layerName}\n62\n${colorIdx}\n10\n${center.x}\n20\n${center.y}\n40\n${radius}\n50\n${(startAngle * 180) / Math.PI}\n51\n${(endAngle * 180) / Math.PI}\n`;
    } else if (obj.__kind__ === "rectangle") {
      const { topLeft, width, height } = obj.rectangle.rectangle;
      dxf += `0\nLINE\n8\n${layerName}\n62\n${colorIdx}\n10\n${topLeft.x}\n20\n${topLeft.y}\n11\n${topLeft.x + width}\n21\n${topLeft.y}\n`;
      dxf += `0\nLINE\n8\n${layerName}\n62\n${colorIdx}\n10\n${topLeft.x + width}\n20\n${topLeft.y}\n11\n${topLeft.x + width}\n21\n${topLeft.y + height}\n`;
      dxf += `0\nLINE\n8\n${layerName}\n62\n${colorIdx}\n10\n${topLeft.x + width}\n20\n${topLeft.y + height}\n11\n${topLeft.x}\n21\n${topLeft.y + height}\n`;
      dxf += `0\nLINE\n8\n${layerName}\n62\n${colorIdx}\n10\n${topLeft.x}\n20\n${topLeft.y + height}\n11\n${topLeft.x}\n21\n${topLeft.y}\n`;
    } else if (obj.__kind__ === "ellipse") {
      const { center, radiusX, radiusY } = obj.ellipse.ellipse;
      dxf += `0\nELLIPSE\n8\n${layerName}\n62\n${colorIdx}\n10\n${center.x}\n20\n${center.y}\n11\n${radiusX}\n21\n0\n40\n${radiusY / radiusX}\n41\n0\n42\n6.283185307\n`;
    } else if (obj.__kind__ === "polyline") {
      const points = obj.polyline.polyline.points;
      if (points.length > 1) {
        dxf += `0\nLWPOLYLINE\n8\n${layerName}\n62\n${colorIdx}\n90\n${points.length}\n70\n0\n`;
        for (const p of points) {
          dxf += `10\n${p.x}\n20\n${p.y}\n`;
        }
      }
    }
  }

  dxf += "0\nENDSEC\n0\nEOF\n";
  return dxf;
}

// Module-level helpers (no closure needed)
function getObjectLayerStatic(obj: DrawingObject): bigint {
  switch (obj.__kind__) {
    case "line":
      return obj.line.layer;
    case "circle":
      return obj.circle.layer;
    case "arc":
      return obj.arc.layer;
    case "rectangle":
      return obj.rectangle.layer;
    case "ellipse":
      return obj.ellipse.layer;
    case "octagon":
      return obj.octagon.layer;
    case "polyline":
      return obj.polyline.layer;
    default:
      return BigInt(0);
  }
}

function getObjectColorStatic(obj: DrawingObject): Color {
  switch (obj.__kind__) {
    case "line":
      return obj.line.color;
    case "circle":
      return obj.circle.color;
    case "arc":
      return obj.arc.color;
    case "rectangle":
      return obj.rectangle.color;
    case "ellipse":
      return obj.ellipse.color;
    case "octagon":
      return obj.octagon.color;
    case "polyline":
      return obj.polyline.color;
    default:
      return Color.white;
  }
}

// ─── Main hook ──────────────────────────────────────────────────────────────
export function useImportExport(
  objects: DrawingObject[],
  layers: LayerState[],
  canvasRef: RefObject<HTMLCanvasElement | null>,
) {
  const importDXF = (content: string): ImportResult =>
    parseDXFTextContent(content);
  const importDWG = (content: string): ImportResult =>
    parseDXFTextContent(content);

  const importSVG = (svgContent: string): DrawingObject[] => {
    const importedObjects: DrawingObject[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");

    for (const el of doc.querySelectorAll("line")) {
      importedObjects.push({
        __kind__: "line",
        line: {
          line: {
            start: {
              x: Number.parseFloat(el.getAttribute("x1") ?? "0"),
              y: Number.parseFloat(el.getAttribute("y1") ?? "0"),
            },
            end: {
              x: Number.parseFloat(el.getAttribute("x2") ?? "0"),
              y: Number.parseFloat(el.getAttribute("y2") ?? "0"),
            },
          },
          color: Color.white,
          rotation: 0,
          layer: BigInt(0),
        },
      });
    }

    for (const el of doc.querySelectorAll("circle")) {
      importedObjects.push({
        __kind__: "circle",
        circle: {
          circle: {
            center: {
              x: Number.parseFloat(el.getAttribute("cx") ?? "0"),
              y: Number.parseFloat(el.getAttribute("cy") ?? "0"),
            },
            radius: Number.parseFloat(el.getAttribute("r") ?? "0"),
          },
          color: Color.white,
          rotation: 0,
          layer: BigInt(0),
          fill: Color.none,
        },
      });
    }

    for (const el of doc.querySelectorAll("rect")) {
      importedObjects.push({
        __kind__: "rectangle",
        rectangle: {
          rectangle: {
            topLeft: {
              x: Number.parseFloat(el.getAttribute("x") ?? "0"),
              y: Number.parseFloat(el.getAttribute("y") ?? "0"),
            },
            width: Number.parseFloat(el.getAttribute("width") ?? "0"),
            height: Number.parseFloat(el.getAttribute("height") ?? "0"),
          },
          color: Color.white,
          rotation: 0,
          layer: BigInt(0),
          fill: Color.none,
        },
      });
    }

    for (const el of doc.querySelectorAll("ellipse")) {
      importedObjects.push({
        __kind__: "ellipse",
        ellipse: {
          ellipse: {
            center: {
              x: Number.parseFloat(el.getAttribute("cx") ?? "0"),
              y: Number.parseFloat(el.getAttribute("cy") ?? "0"),
            },
            radiusX: Number.parseFloat(el.getAttribute("rx") ?? "0"),
            radiusY: Number.parseFloat(el.getAttribute("ry") ?? "0"),
          },
          color: Color.white,
          rotation: 0,
          layer: BigInt(0),
          fill: Color.none,
        },
      });
    }

    return importedObjects;
  };

  const importPDFAsBackground = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: typedArray });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2.0 });

    const offscreen = document.createElement("canvas");
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;

    await page.render({ canvas: offscreen, viewport }).promise;
    return offscreen.toDataURL("image/png");
  };

  const exportDXF = () => {
    const content = buildDXFString(objects, layers);
    downloadBlob(
      new Blob([content], { type: "application/dxf" }),
      `drawing_${Date.now()}.dxf`,
    );
  };

  const exportDWG = () => {
    const content = buildDXFString(objects, layers);
    downloadBlob(
      new Blob([content], { type: "application/octet-stream" }),
      `drawing_${Date.now()}.dwg`,
    );
  };

  const exportSVG = () => {
    let svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000">\n';
    svg += '<rect width="100%" height="100%" fill="black"/>\n';

    for (const obj of objects) {
      const layerId = Number(getObjectLayerStatic(obj));
      const layer = layers.find((l) => l.id === layerId);
      const strokeColor = layer?.visible ? layer.color || "#ffffff" : "#ffffff";

      if (obj.__kind__ === "line") {
        const { start, end } = obj.line.line;
        svg += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === "circle") {
        const { center, radius } = obj.circle.circle;
        svg += `<circle cx="${center.x}" cy="${center.y}" r="${radius}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === "arc") {
        const { center, radius, startAngle, endAngle } = obj.arc.arc;
        const sx = center.x + radius * Math.cos(startAngle);
        const sy = center.y + radius * Math.sin(startAngle);
        const ex = center.x + radius * Math.cos(endAngle);
        const ey = center.y + radius * Math.sin(endAngle);
        const large = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
        svg += `<path d="M ${sx} ${sy} A ${radius} ${radius} 0 ${large} 1 ${ex} ${ey}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === "rectangle") {
        const { topLeft, width, height } = obj.rectangle.rectangle;
        svg += `<rect x="${topLeft.x}" y="${topLeft.y}" width="${width}" height="${height}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === "ellipse") {
        const { center, radiusX, radiusY } = obj.ellipse.ellipse;
        svg += `<ellipse cx="${center.x}" cy="${center.y}" rx="${radiusX}" ry="${radiusY}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === "polyline") {
        const pts = obj.polyline.polyline.points
          .map((p) => `${p.x},${p.y}`)
          .join(" ");
        svg += `<polyline points="${pts}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      }
    }

    svg += "</svg>";
    downloadBlob(
      new Blob([svg], { type: "image/svg+xml" }),
      `drawing_${Date.now()}.svg`,
    );
  };

  const exportPDF = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const pdf = new jsPDF({
          orientation: canvas.width > canvas.height ? "landscape" : "portrait",
          unit: "px",
          format: [canvas.width, canvas.height],
        });
        pdf.addImage(dataUrl, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(`drawing_${Date.now()}.pdf`);
      };
      reader.readAsDataURL(blob);
    }, "image/png");
  };

  return {
    importDXF,
    importDWG,
    importSVG,
    importPDFAsBackground,
    exportDXF,
    exportDWG,
    exportSVG,
    exportPDF,
  };
}
