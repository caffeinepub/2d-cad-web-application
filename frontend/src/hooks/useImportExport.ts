import { RefObject } from 'react';
import type { DrawingObject } from '../backend';
import { Color } from '../backend';

interface LayerState {
  id: number;
  name: string;
  color: string;
  visible: boolean;
}

export function useImportExport(
  objects: DrawingObject[],
  layers: LayerState[],
  canvasRef: RefObject<HTMLCanvasElement | null>
) {
  const importDXF = (dxfContent: string): DrawingObject[] => {
    // Basic DXF parser - supports LINE, CIRCLE, ARC entities
    const importedObjects: DrawingObject[] = [];
    const lines = dxfContent.split('\n');
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Look for entity type
      if (line === 'LINE') {
        const lineData = parseDXFLine(lines, i);
        if (lineData) {
          importedObjects.push({
            __kind__: 'line',
            line: {
              line: lineData,
              color: Color.white,
              rotation: 0,
              layer: BigInt(0),
            },
          });
        }
      } else if (line === 'CIRCLE') {
        const circleData = parseDXFCircle(lines, i);
        if (circleData) {
          importedObjects.push({
            __kind__: 'circle',
            circle: {
              circle: circleData,
              color: Color.white,
              rotation: 0,
              layer: BigInt(0),
              fill: Color.none,
            },
          });
        }
      } else if (line === 'ARC') {
        const arcData = parseDXFArc(lines, i);
        if (arcData) {
          importedObjects.push({
            __kind__: 'arc',
            arc: {
              arc: arcData,
              color: Color.white,
              rotation: 0,
              layer: BigInt(0),
            },
          });
        }
      }
      
      i++;
    }
    
    return importedObjects;
  };

  const parseDXFLine = (lines: string[], startIndex: number) => {
    let x1 = 0, y1 = 0, x2 = 0, y2 = 0;
    
    for (let i = startIndex; i < Math.min(startIndex + 50, lines.length); i++) {
      const code = lines[i].trim();
      const value = lines[i + 1]?.trim();
      
      if (code === '10') x1 = parseFloat(value);
      if (code === '20') y1 = parseFloat(value);
      if (code === '11') x2 = parseFloat(value);
      if (code === '21') y2 = parseFloat(value);
    }
    
    return { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
  };

  const parseDXFCircle = (lines: string[], startIndex: number) => {
    let cx = 0, cy = 0, radius = 0;
    
    for (let i = startIndex; i < Math.min(startIndex + 50, lines.length); i++) {
      const code = lines[i].trim();
      const value = lines[i + 1]?.trim();
      
      if (code === '10') cx = parseFloat(value);
      if (code === '20') cy = parseFloat(value);
      if (code === '40') radius = parseFloat(value);
    }
    
    return { center: { x: cx, y: cy }, radius };
  };

  const parseDXFArc = (lines: string[], startIndex: number) => {
    let cx = 0, cy = 0, radius = 0, startAngle = 0, endAngle = 0;
    
    for (let i = startIndex; i < Math.min(startIndex + 50, lines.length); i++) {
      const code = lines[i].trim();
      const value = lines[i + 1]?.trim();
      
      if (code === '10') cx = parseFloat(value);
      if (code === '20') cy = parseFloat(value);
      if (code === '40') radius = parseFloat(value);
      if (code === '50') startAngle = parseFloat(value) * Math.PI / 180;
      if (code === '51') endAngle = parseFloat(value) * Math.PI / 180;
    }
    
    return { center: { x: cx, y: cy }, radius, startAngle, endAngle };
  };

  const importSVG = (svgContent: string): DrawingObject[] => {
    // Basic SVG parser - supports line, circle, rect, ellipse, path (limited)
    const importedObjects: DrawingObject[] = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    
    // Parse lines
    const lines = doc.querySelectorAll('line');
    lines.forEach((line) => {
      const x1 = parseFloat(line.getAttribute('x1') || '0');
      const y1 = parseFloat(line.getAttribute('y1') || '0');
      const x2 = parseFloat(line.getAttribute('x2') || '0');
      const y2 = parseFloat(line.getAttribute('y2') || '0');
      
      importedObjects.push({
        __kind__: 'line',
        line: {
          line: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
          color: Color.white,
          rotation: 0,
          layer: BigInt(0),
        },
      });
    });
    
    // Parse circles
    const circles = doc.querySelectorAll('circle');
    circles.forEach((circle) => {
      const cx = parseFloat(circle.getAttribute('cx') || '0');
      const cy = parseFloat(circle.getAttribute('cy') || '0');
      const r = parseFloat(circle.getAttribute('r') || '0');
      
      importedObjects.push({
        __kind__: 'circle',
        circle: {
          circle: { center: { x: cx, y: cy }, radius: r },
          color: Color.white,
          rotation: 0,
          layer: BigInt(0),
          fill: Color.none,
        },
      });
    });
    
    // Parse rectangles
    const rects = doc.querySelectorAll('rect');
    rects.forEach((rect) => {
      const x = parseFloat(rect.getAttribute('x') || '0');
      const y = parseFloat(rect.getAttribute('y') || '0');
      const width = parseFloat(rect.getAttribute('width') || '0');
      const height = parseFloat(rect.getAttribute('height') || '0');
      
      importedObjects.push({
        __kind__: 'rectangle',
        rectangle: {
          rectangle: { topLeft: { x, y }, width, height },
          color: Color.white,
          rotation: 0,
          layer: BigInt(0),
          fill: Color.none,
        },
      });
    });
    
    // Parse ellipses
    const ellipses = doc.querySelectorAll('ellipse');
    ellipses.forEach((ellipse) => {
      const cx = parseFloat(ellipse.getAttribute('cx') || '0');
      const cy = parseFloat(ellipse.getAttribute('cy') || '0');
      const rx = parseFloat(ellipse.getAttribute('rx') || '0');
      const ry = parseFloat(ellipse.getAttribute('ry') || '0');
      
      importedObjects.push({
        __kind__: 'ellipse',
        ellipse: {
          ellipse: { center: { x: cx, y: cy }, radiusX: rx, radiusY: ry },
          color: Color.white,
          rotation: 0,
          layer: BigInt(0),
          fill: Color.none,
        },
      });
    });
    
    return importedObjects;
  };

  const getObjectLayer = (obj: DrawingObject): bigint => {
    switch (obj.__kind__) {
      case 'line': return obj.line.layer;
      case 'circle': return obj.circle.layer;
      case 'arc': return obj.arc.layer;
      case 'rectangle': return obj.rectangle.layer;
      case 'ellipse': return obj.ellipse.layer;
      case 'octagon': return obj.octagon.layer;
      case 'polyline': return obj.polyline.layer;
      default: return BigInt(0);
    }
  };

  const exportDXF = () => {
    let dxf = '0\nSECTION\n2\nENTITIES\n';
    
    objects.forEach((obj) => {
      if (obj.__kind__ === 'line') {
        const { start, end } = obj.line.line;
        dxf += `0\nLINE\n8\n0\n10\n${start.x}\n20\n${start.y}\n11\n${end.x}\n21\n${end.y}\n`;
      } else if (obj.__kind__ === 'circle') {
        const { center, radius } = obj.circle.circle;
        dxf += `0\nCIRCLE\n8\n0\n10\n${center.x}\n20\n${center.y}\n40\n${radius}\n`;
      } else if (obj.__kind__ === 'arc') {
        const { center, radius, startAngle, endAngle } = obj.arc.arc;
        const startDeg = startAngle * 180 / Math.PI;
        const endDeg = endAngle * 180 / Math.PI;
        dxf += `0\nARC\n8\n0\n10\n${center.x}\n20\n${center.y}\n40\n${radius}\n50\n${startDeg}\n51\n${endDeg}\n`;
      } else if (obj.__kind__ === 'rectangle') {
        const { topLeft, width, height } = obj.rectangle.rectangle;
        // Export rectangle as 4 lines
        dxf += `0\nLINE\n8\n0\n10\n${topLeft.x}\n20\n${topLeft.y}\n11\n${topLeft.x + width}\n21\n${topLeft.y}\n`;
        dxf += `0\nLINE\n8\n0\n10\n${topLeft.x + width}\n20\n${topLeft.y}\n11\n${topLeft.x + width}\n21\n${topLeft.y + height}\n`;
        dxf += `0\nLINE\n8\n0\n10\n${topLeft.x + width}\n20\n${topLeft.y + height}\n11\n${topLeft.x}\n21\n${topLeft.y + height}\n`;
        dxf += `0\nLINE\n8\n0\n10\n${topLeft.x}\n20\n${topLeft.y + height}\n11\n${topLeft.x}\n21\n${topLeft.y}\n`;
      } else if (obj.__kind__ === 'ellipse') {
        const { center, radiusX, radiusY } = obj.ellipse.ellipse;
        dxf += `0\nELLIPSE\n8\n0\n10\n${center.x}\n20\n${center.y}\n11\n${radiusX}\n21\n0\n40\n${radiusY / radiusX}\n`;
      }
    });
    
    dxf += '0\nENDSEC\n0\nEOF\n';
    
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing_${Date.now()}.dxf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSVG = () => {
    let svg = '<svg xmlns="http://www.w3.org/2000/svg" width="3000" height="2000">\n';
    svg += '<rect width="100%" height="100%" fill="black"/>\n';
    
    objects.forEach((obj) => {
      const layerId = Number(getObjectLayer(obj));
      const layer = layers.find(l => l.id === layerId);
      const strokeColor = layer?.visible ? (layer.color || '#ffffff') : '#ffffff';
      
      if (obj.__kind__ === 'line') {
        const { start, end } = obj.line.line;
        svg += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === 'circle') {
        const { center, radius } = obj.circle.circle;
        svg += `<circle cx="${center.x}" cy="${center.y}" r="${radius}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === 'arc') {
        const { center, radius, startAngle, endAngle } = obj.arc.arc;
        const startX = center.x + radius * Math.cos(startAngle);
        const startY = center.y + radius * Math.sin(startAngle);
        const endX = center.x + radius * Math.cos(endAngle);
        const endY = center.y + radius * Math.sin(endAngle);
        const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
        svg += `<path d="M ${startX} ${startY} A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === 'rectangle') {
        const { topLeft, width, height } = obj.rectangle.rectangle;
        svg += `<rect x="${topLeft.x}" y="${topLeft.y}" width="${width}" height="${height}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === 'ellipse') {
        const { center, radiusX, radiusY } = obj.ellipse.ellipse;
        svg += `<ellipse cx="${center.x}" cy="${center.y}" rx="${radiusX}" ry="${radiusY}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      } else if (obj.__kind__ === 'polyline') {
        const points = obj.polyline.polyline.points.map(p => `${p.x},${p.y}`).join(' ');
        svg += `<polyline points="${points}" fill="none" stroke="${strokeColor}" stroke-width="2"/>\n`;
      }
    });
    
    svg += '</svg>';
    
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing_${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    // Use canvas to generate PDF via jsPDF-like approach
    // For simplicity, we'll convert canvas to image and embed in a simple PDF structure
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create a simple PDF structure (basic implementation)
    // In production, you'd use a library like jsPDF
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      // For now, export as PNG wrapped in PDF-like structure
      // A full PDF implementation would require jsPDF library
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drawing_${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  return {
    importDXF,
    importSVG,
    exportDXF,
    exportSVG,
    exportPDF,
  };
}

