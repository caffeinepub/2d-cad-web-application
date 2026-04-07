import { useState, useEffect, useRef, RefObject } from 'react';
import type { DrawingObject, Layer } from '../backend';
import { Color } from '../backend';
import type { Tool } from '../components/ToolPalette';
import type { UnitType } from './useUnits';

interface Point {
  x: number;
  y: number;
}

interface CADObject {
  id: string;
  type: 'line' | 'circle' | 'ellipse' | 'rectangle' | 'octagon' | 'polyline' | 'arc';
  data: DrawingObject;
  layerId: number;
}

interface LayerState {
  id: number;
  name: string;
  color: string;
  visible: boolean;
}

interface SnapPoint {
  point: Point;
  type: 'corner' | 'endpoint' | 'center' | 'circle-center' | 'intersection' | 'edge-midpoint';
}

interface MeasurementData {
  type: 'distance' | 'angle';
  points: Point[];
  value: number;
}

interface EdgeInfo {
  objectId: string;
  edgeIndex: number;
  start: Point;
  end: Point;
}

interface UseCADEngineProps {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  unit?: UnitType;
  convertFromPixels?: (value: number, toUnit?: UnitType) => number;
  getUnitLabel?: (toUnit?: UnitType) => string;
}

export function useCADEngine(
  canvasRefOrProps: RefObject<HTMLCanvasElement | null> | UseCADEngineProps
) {
  // Support both old and new API
  const canvasRef = 'current' in canvasRefOrProps ? canvasRefOrProps : canvasRefOrProps.canvasRef;
  const unit = 'current' in canvasRefOrProps ? undefined : canvasRefOrProps.unit;
  const convertFromPixels = 'current' in canvasRefOrProps ? undefined : canvasRefOrProps.convertFromPixels;
  const getUnitLabel = 'current' in canvasRefOrProps ? undefined : canvasRefOrProps.getUnitLabel;

  const [tool, setTool] = useState<Tool>('select');
  const [objects, setObjects] = useState<CADObject[]>([]);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [history, setHistory] = useState<CADObject[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [snapEnabled, setSnapEnabled] = useState(true);
  
  // Layer management
  const [layers, setLayers] = useState<LayerState[]>([
    { id: 0, name: 'Layer 1', color: '#ffffff', visible: true }
  ]);
  const [activeLayerId, setActiveLayerId] = useState(0);
  const [nextLayerId, setNextLayerId] = useState(1);

  // Drawing state
  const drawingStateRef = useRef<{
    isDrawing: boolean;
    startPoint: Point | null;
    currentPoint: Point | null;
    polylinePoints: Point[];
    isDragging: boolean;
    dragStart: Point | null;
    originalObjectsData: Map<string, DrawingObject>;
    isRectangleSelecting: boolean;
    rectangleSelectStart: Point | null;
    snapPoint: SnapPoint | null;
    measurementPoints: Point[];
    measurements: MeasurementData[];
    isPanning: boolean;
    panStart: Point | null;
    panStartOffset: Point | null;
    arcEditState: {
      selectedEdge: EdgeInfo | null;
      arcCenter: Point | null;
      isDefiningArc: boolean;
    };
  }>({
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
    polylinePoints: [],
    isDragging: false,
    dragStart: null,
    originalObjectsData: new Map(),
    isRectangleSelecting: false,
    rectangleSelectStart: null,
    snapPoint: null,
    measurementPoints: [],
    measurements: [],
    isPanning: false,
    panStart: null,
    panStartOffset: null,
    arcEditState: {
      selectedEdge: null,
      arcCenter: null,
      isDefiningArc: false,
    },
  });

  // Transform screen coordinates to canvas coordinates
  const screenToCanvas = (screenX: number, screenY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  };

  // Get all edges from objects (including rectangle and octagon edges)
  const getAllEdges = (): EdgeInfo[] => {
    const edges: EdgeInfo[] = [];
    
    for (const obj of objects) {
      const layer = layers.find(l => l.id === obj.layerId);
      if (!layer?.visible) continue;

      const data = obj.data;

      if (data.__kind__ === 'line') {
        edges.push({
          objectId: obj.id,
          edgeIndex: 0,
          start: data.line.line.start,
          end: data.line.line.end,
        });
      } else if (data.__kind__ === 'rectangle') {
        const rectEdges = getRectangleEdges(data.rectangle.rectangle);
        rectEdges.forEach((edge, index) => {
          edges.push({
            objectId: obj.id,
            edgeIndex: index,
            start: edge.start,
            end: edge.end,
          });
        });
      } else if (data.__kind__ === 'octagon') {
        const octEdges = getOctagonEdges(data.octagon.octagon.center, data.octagon.octagon.size);
        octEdges.forEach((edge, index) => {
          edges.push({
            objectId: obj.id,
            edgeIndex: index,
            start: edge.start,
            end: edge.end,
          });
        });
      } else if (data.__kind__ === 'polyline') {
        for (let i = 0; i < data.polyline.polyline.points.length - 1; i++) {
          edges.push({
            objectId: obj.id,
            edgeIndex: i,
            start: data.polyline.polyline.points[i],
            end: data.polyline.polyline.points[i + 1],
          });
        }
      }
    }
    
    return edges;
  };

  // Get rectangle edges
  const getRectangleEdges = (rect: { topLeft: Point; width: number; height: number }): Array<{ start: Point; end: Point }> => {
    const topLeft = rect.topLeft;
    const topRight = { x: topLeft.x + rect.width, y: topLeft.y };
    const bottomLeft = { x: topLeft.x, y: topLeft.y + rect.height };
    const bottomRight = { x: topLeft.x + rect.width, y: topLeft.y + rect.height };

    return [
      { start: topLeft, end: topRight },
      { start: topRight, end: bottomRight },
      { start: bottomRight, end: bottomLeft },
      { start: bottomLeft, end: topLeft },
    ];
  };

  // Get octagon edges
  const getOctagonEdges = (center: Point, size: number): Array<{ start: Point; end: Point }> => {
    const corners = getOctagonCorners(center, size);
    const edges: Array<{ start: Point; end: Point }> = [];
    
    for (let i = 0; i < corners.length; i++) {
      const next = (i + 1) % corners.length;
      edges.push({
        start: corners[i],
        end: corners[next],
      });
    }
    
    return edges;
  };

  // Calculate line-to-line intersection
  const getLineIntersection = (
    line1: { start: Point; end: Point },
    line2: { start: Point; end: Point }
  ): Point | null => {
    const x1 = line1.start.x, y1 = line1.start.y;
    const x2 = line1.end.x, y2 = line1.end.y;
    const x3 = line2.start.x, y3 = line2.start.y;
    const x4 = line2.end.x, y4 = line2.end.y;

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.0001) return null;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
      };
    }

    return null;
  };

  // Calculate circle-to-circle intersections
  const getCircleCircleIntersections = (
    c1: { center: Point; radius: number },
    c2: { center: Point; radius: number }
  ): Point[] => {
    const dx = c2.center.x - c1.center.x;
    const dy = c2.center.y - c1.center.y;
    const d = Math.sqrt(dx * dx + dy * dy);

    // No intersection if circles are too far apart or one contains the other
    if (d > c1.radius + c2.radius || d < Math.abs(c1.radius - c2.radius) || d < 0.0001) {
      return [];
    }

    // One intersection point if circles are tangent
    if (Math.abs(d - (c1.radius + c2.radius)) < 0.0001) {
      const t = c1.radius / d;
      return [{
        x: c1.center.x + t * dx,
        y: c1.center.y + t * dy,
      }];
    }

    // Two intersection points
    const a = (c1.radius * c1.radius - c2.radius * c2.radius + d * d) / (2 * d);
    const h = Math.sqrt(c1.radius * c1.radius - a * a);

    const px = c1.center.x + (a * dx) / d;
    const py = c1.center.y + (a * dy) / d;

    return [
      {
        x: px + (h * dy) / d,
        y: py - (h * dx) / d,
      },
      {
        x: px - (h * dy) / d,
        y: py + (h * dx) / d,
      },
    ];
  };

  // Calculate line-to-circle intersections
  const getLineCircleIntersections = (
    line: { start: Point; end: Point },
    circle: { center: Point; radius: number }
  ): Point[] => {
    const dx = line.end.x - line.start.x;
    const dy = line.end.y - line.start.y;
    const fx = line.start.x - circle.center.x;
    const fy = line.start.y - circle.center.y;

    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - circle.radius * circle.radius;

    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) {
      return []; // No intersection
    }

    const sqrtDiscriminant = Math.sqrt(discriminant);
    const t1 = (-b - sqrtDiscriminant) / (2 * a);
    const t2 = (-b + sqrtDiscriminant) / (2 * a);

    const intersections: Point[] = [];

    // Check if t1 is within the line segment
    if (t1 >= 0 && t1 <= 1) {
      intersections.push({
        x: line.start.x + t1 * dx,
        y: line.start.y + t1 * dy,
      });
    }

    // Check if t2 is within the line segment (and different from t1)
    if (t2 >= 0 && t2 <= 1 && Math.abs(t2 - t1) > 0.0001) {
      intersections.push({
        x: line.start.x + t2 * dx,
        y: line.start.y + t2 * dy,
      });
    }

    return intersections;
  };

  // Normalize angle to [0, 2π]
  const normalizeAngle = (angle: number): number => {
    let normalized = angle % (2 * Math.PI);
    if (normalized < 0) normalized += 2 * Math.PI;
    return normalized;
  };

  // Explode objects at intersection points
  const explodeObjects = () => {
    const newObjects: CADObject[] = [];
    const processedObjectIds = new Set<string>();

    // Get all edges from all objects
    const allEdges = getAllEdges();
    
    // Get all circles
    const circles: Array<{ id: string; obj: CADObject; center: Point; radius: number }> = [];
    for (const obj of objects) {
      const layer = layers.find(l => l.id === obj.layerId);
      if (!layer?.visible) continue;

      const data = obj.data;
      if (data.__kind__ === 'circle') {
        circles.push({
          id: obj.id,
          obj,
          center: data.circle.circle.center,
          radius: data.circle.circle.radius,
        });
      }
    }

    // Process circles - split them at intersection points
    for (const circleInfo of circles) {
      if (processedObjectIds.has(circleInfo.id)) continue;

      const intersectionAngles: number[] = [];

      // Find intersections with other circles
      for (const otherCircle of circles) {
        if (otherCircle.id === circleInfo.id) continue;
        
        const intersections = getCircleCircleIntersections(
          { center: circleInfo.center, radius: circleInfo.radius },
          { center: otherCircle.center, radius: otherCircle.radius }
        );

        for (const intersection of intersections) {
          const angle = Math.atan2(
            intersection.y - circleInfo.center.y,
            intersection.x - circleInfo.center.x
          );
          intersectionAngles.push(normalizeAngle(angle));
        }
      }

      // Find intersections with lines (including rectangle and octagon edges)
      for (const edge of allEdges) {
        const intersections = getLineCircleIntersections(
          { start: edge.start, end: edge.end },
          { center: circleInfo.center, radius: circleInfo.radius }
        );

        for (const intersection of intersections) {
          const angle = Math.atan2(
            intersection.y - circleInfo.center.y,
            intersection.x - circleInfo.center.x
          );
          intersectionAngles.push(normalizeAngle(angle));
        }
      }

      // If there are intersections, split the circle into arcs
      if (intersectionAngles.length > 0) {
        // Sort angles
        intersectionAngles.sort((a, b) => a - b);

        // Remove duplicate angles
        const uniqueAngles: number[] = [];
        for (let i = 0; i < intersectionAngles.length; i++) {
          if (i === 0 || Math.abs(intersectionAngles[i] - intersectionAngles[i - 1]) > 0.01) {
            uniqueAngles.push(intersectionAngles[i]);
          }
        }

        // Create arc segments between consecutive angles
        for (let i = 0; i < uniqueAngles.length; i++) {
          const startAngle = uniqueAngles[i];
          const endAngle = uniqueAngles[(i + 1) % uniqueAngles.length];

          const data = circleInfo.obj.data;
          let color = Color.white;
          let rotation = 0;

          if (data.__kind__ === 'circle') {
            color = data.circle.color;
            rotation = data.circle.rotation;
          }

          newObjects.push({
            id: `obj_${Date.now()}_${Math.random()}`,
            type: 'arc',
            data: {
              __kind__: 'arc',
              arc: {
                arc: {
                  center: circleInfo.center,
                  radius: circleInfo.radius,
                  startAngle,
                  endAngle,
                },
                color,
                rotation,
                layer: BigInt(circleInfo.obj.layerId),
              },
            },
            layerId: circleInfo.obj.layerId,
          });
        }

        processedObjectIds.add(circleInfo.id);
      } else {
        // No intersections, keep the circle as-is
        newObjects.push(circleInfo.obj);
      }
    }
    
    // For each object, find all intersections with other objects
    for (const obj of objects) {
      if (processedObjectIds.has(obj.id)) continue;

      const layer = layers.find(l => l.id === obj.layerId);
      if (!layer?.visible) {
        newObjects.push(obj);
        continue;
      }

      const data = obj.data;

      // Handle lines, rectangles, octagons, and polylines
      if (data.__kind__ === 'line' || data.__kind__ === 'rectangle' || 
          data.__kind__ === 'octagon' || data.__kind__ === 'polyline') {
        
        let objectEdges: Array<{ start: Point; end: Point }> = [];
        
        if (data.__kind__ === 'line') {
          objectEdges = [{ start: data.line.line.start, end: data.line.line.end }];
        } else if (data.__kind__ === 'rectangle') {
          objectEdges = getRectangleEdges(data.rectangle.rectangle);
        } else if (data.__kind__ === 'octagon') {
          objectEdges = getOctagonEdges(data.octagon.octagon.center, data.octagon.octagon.size);
        } else if (data.__kind__ === 'polyline') {
          for (let i = 0; i < data.polyline.polyline.points.length - 1; i++) {
            objectEdges.push({
              start: data.polyline.polyline.points[i],
              end: data.polyline.polyline.points[i + 1],
            });
          }
        }

        // For each edge, find all intersection points
        const explodedEdges: Array<{ start: Point; end: Point }> = [];
        
        for (const edge of objectEdges) {
          const intersectionPoints: Point[] = [];
          
          // Find intersections with all other edges
          for (const otherEdge of allEdges) {
            if (otherEdge.objectId === obj.id) continue;
            
            const intersection = getLineIntersection(edge, otherEdge);
            if (intersection) {
              // Check if intersection is not at endpoints
              const isAtStart = Math.abs(intersection.x - edge.start.x) < 0.01 && 
                               Math.abs(intersection.y - edge.start.y) < 0.01;
              const isAtEnd = Math.abs(intersection.x - edge.end.x) < 0.01 && 
                             Math.abs(intersection.y - edge.end.y) < 0.01;
              
              if (!isAtStart && !isAtEnd) {
                intersectionPoints.push(intersection);
              }
            }
          }

          // Find intersections with circles and ellipses
          for (const otherObj of objects) {
            if (otherObj.id === obj.id) continue;
            
            const otherData = otherObj.data;
            if (otherData.__kind__ === 'circle') {
              const intersections = getLineCircleIntersections(edge, otherData.circle.circle);
              intersectionPoints.push(...intersections);
            } else if (otherData.__kind__ === 'ellipse') {
              // Approximate ellipse as circle for intersection
              const avgRadius = (otherData.ellipse.ellipse.radiusX + otherData.ellipse.ellipse.radiusY) / 2;
              const intersections = getLineCircleIntersections(edge, {
                center: otherData.ellipse.ellipse.center,
                radius: avgRadius,
              });
              intersectionPoints.push(...intersections);
            }
          }

          // Sort intersection points along the edge
          if (intersectionPoints.length > 0) {
            const sortedPoints = [edge.start, ...intersectionPoints, edge.end].sort((a, b) => {
              const distA = Math.sqrt((a.x - edge.start.x) ** 2 + (a.y - edge.start.y) ** 2);
              const distB = Math.sqrt((b.x - edge.start.x) ** 2 + (b.y - edge.start.y) ** 2);
              return distA - distB;
            });

            // Create segments between consecutive points
            for (let i = 0; i < sortedPoints.length - 1; i++) {
              explodedEdges.push({
                start: sortedPoints[i],
                end: sortedPoints[i + 1],
              });
            }
          } else {
            explodedEdges.push(edge);
          }
        }

        // Create new line objects for each exploded edge
        let color = Color.white;
        let rotation = 0;
        
        if (data.__kind__ === 'line') {
          color = data.line.color;
          rotation = data.line.rotation;
        } else if (data.__kind__ === 'rectangle') {
          color = data.rectangle.color;
          rotation = data.rectangle.rotation;
        } else if (data.__kind__ === 'octagon') {
          color = data.octagon.color;
          rotation = data.octagon.rotation;
        } else if (data.__kind__ === 'polyline') {
          color = data.polyline.color;
          rotation = data.polyline.rotation;
        }

        for (const explodedEdge of explodedEdges) {
          newObjects.push({
            id: `obj_${Date.now()}_${Math.random()}`,
            type: 'line',
            data: {
              __kind__: 'line',
              line: {
                line: explodedEdge,
                color,
                rotation,
                layer: BigInt(obj.layerId),
              },
            },
            layerId: obj.layerId,
          });
        }

        processedObjectIds.add(obj.id);
      } else {
        // Keep ellipses and arcs as-is
        newObjects.push(obj);
      }
    }

    addToHistory(newObjects);
    setSelectedObjectIds([]);
  };

  // Find snap points near a given point
  const findSnapPoint = (point: Point): SnapPoint | null => {
    if (!snapEnabled) return null;
    
    const snapThreshold = 10 / zoom;
    let closestSnap: SnapPoint | null = null;
    let closestDistance = snapThreshold;

    for (const obj of objects) {
      const layer = layers.find(l => l.id === obj.layerId);
      if (!layer?.visible) continue;

      const data = obj.data;

      if (data.__kind__ === 'line') {
        // Endpoints
        const endpoints = [data.line.line.start, data.line.line.end];
        for (const ep of endpoints) {
          const dist = Math.sqrt((point.x - ep.x) ** 2 + (point.y - ep.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: ep, type: 'endpoint' };
          }
        }

        // Center of line
        const center = {
          x: (data.line.line.start.x + data.line.line.end.x) / 2,
          y: (data.line.line.start.y + data.line.line.end.y) / 2,
        };
        const centerDist = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
        if (centerDist < closestDistance) {
          closestDistance = centerDist;
          closestSnap = { point: center, type: 'center' };
        }
      } else if (data.__kind__ === 'circle') {
        // Circle center
        const centerDist = Math.sqrt(
          (point.x - data.circle.circle.center.x) ** 2 + 
          (point.y - data.circle.circle.center.y) ** 2
        );
        if (centerDist < closestDistance) {
          closestDistance = centerDist;
          closestSnap = { point: data.circle.circle.center, type: 'circle-center' };
        }
      } else if (data.__kind__ === 'ellipse') {
        // Ellipse center
        const centerDist = Math.sqrt(
          (point.x - data.ellipse.ellipse.center.x) ** 2 + 
          (point.y - data.ellipse.ellipse.center.y) ** 2
        );
        if (centerDist < closestDistance) {
          closestDistance = centerDist;
          closestSnap = { point: data.ellipse.ellipse.center, type: 'circle-center' };
        }
      } else if (data.__kind__ === 'rectangle') {
        // Corners
        const corners = [
          data.rectangle.rectangle.topLeft,
          { x: data.rectangle.rectangle.topLeft.x + data.rectangle.rectangle.width, y: data.rectangle.rectangle.topLeft.y },
          { x: data.rectangle.rectangle.topLeft.x, y: data.rectangle.rectangle.topLeft.y + data.rectangle.rectangle.height },
          { x: data.rectangle.rectangle.topLeft.x + data.rectangle.rectangle.width, y: data.rectangle.rectangle.topLeft.y + data.rectangle.rectangle.height },
        ];
        for (const corner of corners) {
          const dist = Math.sqrt((point.x - corner.x) ** 2 + (point.y - corner.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: corner, type: 'corner' };
          }
        }

        // Edge midpoints
        const edgeMidpoints = [
          { x: data.rectangle.rectangle.topLeft.x + data.rectangle.rectangle.width / 2, y: data.rectangle.rectangle.topLeft.y },
          { x: data.rectangle.rectangle.topLeft.x + data.rectangle.rectangle.width, y: data.rectangle.rectangle.topLeft.y + data.rectangle.rectangle.height / 2 },
          { x: data.rectangle.rectangle.topLeft.x + data.rectangle.rectangle.width / 2, y: data.rectangle.rectangle.topLeft.y + data.rectangle.rectangle.height },
          { x: data.rectangle.rectangle.topLeft.x, y: data.rectangle.rectangle.topLeft.y + data.rectangle.rectangle.height / 2 },
        ];
        for (const midpoint of edgeMidpoints) {
          const dist = Math.sqrt((point.x - midpoint.x) ** 2 + (point.y - midpoint.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: midpoint, type: 'edge-midpoint' };
          }
        }

        // Center
        const center = {
          x: data.rectangle.rectangle.topLeft.x + data.rectangle.rectangle.width / 2,
          y: data.rectangle.rectangle.topLeft.y + data.rectangle.rectangle.height / 2,
        };
        const centerDist = Math.sqrt((point.x - center.x) ** 2 + (point.y - center.y) ** 2);
        if (centerDist < closestDistance) {
          closestDistance = centerDist;
          closestSnap = { point: center, type: 'center' };
        }
      } else if (data.__kind__ === 'octagon') {
        // Octagon center
        const centerDist = Math.sqrt(
          (point.x - data.octagon.octagon.center.x) ** 2 + 
          (point.y - data.octagon.octagon.center.y) ** 2
        );
        if (centerDist < closestDistance) {
          closestDistance = centerDist;
          closestSnap = { point: data.octagon.octagon.center, type: 'center' };
        }

        // Octagon corners
        const corners = getOctagonCorners(data.octagon.octagon.center, data.octagon.octagon.size);
        for (const corner of corners) {
          const dist = Math.sqrt((point.x - corner.x) ** 2 + (point.y - corner.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: corner, type: 'corner' };
          }
        }

        // Octagon edge midpoints
        for (let i = 0; i < corners.length; i++) {
          const next = (i + 1) % corners.length;
          const midpoint = {
            x: (corners[i].x + corners[next].x) / 2,
            y: (corners[i].y + corners[next].y) / 2,
          };
          const dist = Math.sqrt((point.x - midpoint.x) ** 2 + (point.y - midpoint.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: midpoint, type: 'edge-midpoint' };
          }
        }
      } else if (data.__kind__ === 'polyline') {
        // Endpoints and vertices
        for (const p of data.polyline.polyline.points) {
          const dist = Math.sqrt((point.x - p.x) ** 2 + (point.y - p.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: p, type: 'endpoint' };
          }
        }
      }
    }

    // Check for line-to-line intersections
    const edges = getAllEdges();
    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const intersection = getLineIntersection(
          { start: edges[i].start, end: edges[i].end },
          { start: edges[j].start, end: edges[j].end }
        );
        if (intersection) {
          const dist = Math.sqrt((point.x - intersection.x) ** 2 + (point.y - intersection.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: intersection, type: 'intersection' };
          }
        }
      }
    }

    // Check for circle-to-circle intersections
    const circles: Array<{ id: string; center: Point; radius: number }> = [];
    for (const obj of objects) {
      const layer = layers.find(l => l.id === obj.layerId);
      if (!layer?.visible) continue;

      const data = obj.data;
      if (data.__kind__ === 'circle') {
        circles.push({
          id: obj.id,
          center: data.circle.circle.center,
          radius: data.circle.circle.radius,
        });
      }
    }

    for (let i = 0; i < circles.length; i++) {
      for (let j = i + 1; j < circles.length; j++) {
        const intersections = getCircleCircleIntersections(circles[i], circles[j]);
        for (const intersection of intersections) {
          const dist = Math.sqrt((point.x - intersection.x) ** 2 + (point.y - intersection.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: intersection, type: 'intersection' };
          }
        }
      }
    }

    // Check for line-to-circle intersections
    for (const edge of edges) {
      for (const circle of circles) {
        const intersections = getLineCircleIntersections(
          { start: edge.start, end: edge.end },
          circle
        );
        for (const intersection of intersections) {
          const dist = Math.sqrt((point.x - intersection.x) ** 2 + (point.y - intersection.y) ** 2);
          if (dist < closestDistance) {
            closestDistance = dist;
            closestSnap = { point: intersection, type: 'intersection' };
          }
        }
      }
    }

    return closestSnap;
  };

  // Get octagon corner points
  const getOctagonCorners = (center: Point, size: number): Point[] => {
    const corners: Point[] = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      corners.push({
        x: center.x + size * Math.cos(angle),
        y: center.y + size * Math.sin(angle),
      });
    }
    return corners;
  };

  // Calculate distance between two points
  const calculateDistance = (p1: Point, p2: Point): number => {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  };

  // Calculate angle between three points
  const calculateAngle = (p1: Point, p2: Point, p3: Point): number => {
    const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
    const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };
    
    const dot = v1.x * v2.x + v1.y * v2.y;
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
    
    if (mag1 === 0 || mag2 === 0) return 0;
    
    const angle = Math.acos(dot / (mag1 * mag2));
    return (angle * 180) / Math.PI;
  };

  // Add object to history
  const addToHistory = (newObjects: CADObject[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newObjects);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setObjects(newObjects);
  };

  // Delete selected objects
  const deleteSelectedObjects = () => {
    if (selectedObjectIds.length === 0) return;
    const remainingObjects = objects.filter(obj => !selectedObjectIds.includes(obj.id));
    addToHistory(remainingObjects);
    setSelectedObjectIds([]);
  };

  // Undo/Redo
  const undo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setObjects(history[historyIndex - 1]);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setObjects(history[historyIndex + 1]);
    }
  };

  // Zoom controls
  const zoomIn = () => setZoom((z) => Math.min(z * 1.2, 5));
  const zoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.2));

  // Clear canvas
  const clearCanvas = () => {
    addToHistory([]);
    setSelectedObjectIds([]);
    drawingStateRef.current.measurements = [];
  };

  // Toggle snap
  const toggleSnap = () => setSnapEnabled(!snapEnabled);

  // Layer management functions
  const addLayer = (name: string, color: string) => {
    const newLayer: LayerState = {
      id: nextLayerId,
      name,
      color,
      visible: true,
    };
    setLayers([...layers, newLayer]);
    setNextLayerId(nextLayerId + 1);
    return newLayer.id;
  };

  const updateLayer = (layerId: number, updates: Partial<LayerState>) => {
    setLayers(layers.map(layer => 
      layer.id === layerId ? { ...layer, ...updates } : layer
    ));
  };

  const deleteLayer = (layerId: number) => {
    if (layers.length === 1) return;
    
    const remainingLayers = layers.filter(l => l.id !== layerId);
    const targetLayerId = remainingLayers[0].id;
    
    const updatedObjects = objects.map(obj =>
      obj.layerId === layerId ? { ...obj, layerId: targetLayerId } : obj
    );
    
    setLayers(remainingLayers);
    addToHistory(updatedObjects);
    
    if (activeLayerId === layerId) {
      setActiveLayerId(targetLayerId);
    }
  };

  const toggleLayerVisibility = (layerId: number) => {
    updateLayer(layerId, { 
      visible: !layers.find(l => l.id === layerId)?.visible 
    });
  };

  // Load project data with layers
  const loadProjectData = (projectObjects: DrawingObject[], projectLayers?: Layer[], projectActiveLayer?: number) => {
    const newObjects: CADObject[] = projectObjects.map((obj, index) => ({
      id: `obj_${Date.now()}_${index}`,
      type: obj.__kind__ as any,
      data: obj,
      layerId: 0,
    }));
    
    if (projectLayers && projectLayers.length > 0) {
      const loadedLayers: LayerState[] = projectLayers.map(layer => ({
        id: Number(layer.id),
        name: layer.name,
        color: colorToHex(layer.color),
        visible: layer.visible,
      }));
      setLayers(loadedLayers);
      setNextLayerId(Math.max(...loadedLayers.map(l => l.id)) + 1);
      
      if (projectActiveLayer !== undefined) {
        setActiveLayerId(Number(projectActiveLayer));
      }
    }
    
    addToHistory(newObjects);
    setSelectedObjectIds([]);
    drawingStateRef.current.measurements = [];
  };

  // Convert backend Color enum to hex
  const colorToHex = (color: Color): string => {
    switch (color) {
      case Color.red: return '#ff0000';
      case Color.blue: return '#0000ff';
      case Color.yellow: return '#ffff00';
      case Color.green: return '#00ff00';
      case Color.white: return '#ffffff';
      case Color.none: return 'none';
      default: return '#ffffff';
    }
  };

  // Convert hex to backend Color enum
  const hexToColor = (hex: string): Color => {
    switch (hex.toLowerCase()) {
      case '#ff0000': return Color.red;
      case '#0000ff': return Color.blue;
      case '#ffff00': return Color.yellow;
      case '#00ff00': return Color.green;
      case 'none': return Color.none;
      default: return Color.white;
    }
  };

  // Check if point is near line
  const isPointNearLine = (point: Point, start: Point, end: Point, threshold = 5): boolean => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) return false;

    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length)));
    const projX = start.x + t * dx;
    const projY = start.y + t * dy;
    const distance = Math.sqrt((point.x - projX) ** 2 + (point.y - projY) ** 2);
    return distance < threshold / zoom;
  };

  // Find edge at point (for arc edit tool)
  const findEdgeAtPoint = (point: Point): EdgeInfo | null => {
    const edges = getAllEdges();
    
    for (const edge of edges) {
      if (isPointNearLine(point, edge.start, edge.end)) {
        return edge;
      }
    }
    
    return null;
  };

  // Check if point is inside rectangle
  const isPointInRect = (point: Point, rect: { x: number; y: number; width: number; height: number }): boolean => {
    return point.x >= rect.x && point.x <= rect.x + rect.width &&
           point.y >= rect.y && point.y <= rect.y + rect.height;
  };

  // Get object bounds
  const getObjectBounds = (obj: CADObject): { x: number; y: number; width: number; height: number } | null => {
    const data = obj.data;
    if (data.__kind__ === 'line') {
      const minX = Math.min(data.line.line.start.x, data.line.line.end.x);
      const maxX = Math.max(data.line.line.start.x, data.line.line.end.x);
      const minY = Math.min(data.line.line.start.y, data.line.line.end.y);
      const maxY = Math.max(data.line.line.start.y, data.line.line.end.y);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } else if (data.__kind__ === 'circle') {
      return {
        x: data.circle.circle.center.x - data.circle.circle.radius,
        y: data.circle.circle.center.y - data.circle.circle.radius,
        width: data.circle.circle.radius * 2,
        height: data.circle.circle.radius * 2,
      };
    } else if (data.__kind__ === 'ellipse') {
      return {
        x: data.ellipse.ellipse.center.x - data.ellipse.ellipse.radiusX,
        y: data.ellipse.ellipse.center.y - data.ellipse.ellipse.radiusY,
        width: data.ellipse.ellipse.radiusX * 2,
        height: data.ellipse.ellipse.radiusY * 2,
      };
    } else if (data.__kind__ === 'rectangle') {
      return {
        x: data.rectangle.rectangle.topLeft.x,
        y: data.rectangle.rectangle.topLeft.y,
        width: data.rectangle.rectangle.width,
        height: data.rectangle.rectangle.height,
      };
    } else if (data.__kind__ === 'octagon') {
      const size = data.octagon.octagon.size;
      return {
        x: data.octagon.octagon.center.x - size,
        y: data.octagon.octagon.center.y - size,
        width: size * 2,
        height: size * 2,
      };
    } else if (data.__kind__ === 'polyline') {
      const xs = data.polyline.polyline.points.map(p => p.x);
      const ys = data.polyline.polyline.points.map(p => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    } else if (data.__kind__ === 'arc') {
      const size = data.arc.arc.radius;
      return {
        x: data.arc.arc.center.x - size,
        y: data.arc.arc.center.y - size,
        width: size * 2,
        height: size * 2,
      };
    }
    return null;
  };

  // Find object at point
  const findObjectAtPoint = (point: Point): string | null => {
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      const layer = layers.find(l => l.id === obj.layerId);
      if (!layer?.visible) continue;
      
      const data = obj.data;

      if (data.__kind__ === 'line') {
        if (isPointNearLine(point, data.line.line.start, data.line.line.end)) {
          return obj.id;
        }
      } else if (data.__kind__ === 'circle') {
        const distance = Math.sqrt(
          (point.x - data.circle.circle.center.x) ** 2 + (point.y - data.circle.circle.center.y) ** 2
        );
        if (Math.abs(distance - data.circle.circle.radius) < 5 / zoom) {
          return obj.id;
        }
      } else if (data.__kind__ === 'ellipse') {
        const dx = (point.x - data.ellipse.ellipse.center.x) / data.ellipse.ellipse.radiusX;
        const dy = (point.y - data.ellipse.ellipse.center.y) / data.ellipse.ellipse.radiusY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(distance - 1) < 5 / zoom / Math.max(data.ellipse.ellipse.radiusX, data.ellipse.ellipse.radiusY)) {
          return obj.id;
        }
      } else if (data.__kind__ === 'rectangle') {
        const { topLeft, width, height } = data.rectangle.rectangle;
        if (
          point.x >= topLeft.x &&
          point.x <= topLeft.x + width &&
          point.y >= topLeft.y &&
          point.y <= topLeft.y + height
        ) {
          return obj.id;
        }
      } else if (data.__kind__ === 'octagon') {
        const corners = getOctagonCorners(data.octagon.octagon.center, data.octagon.octagon.size);
        // Check if point is inside octagon using ray casting
        let inside = false;
        for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
          const xi = corners[i].x, yi = corners[i].y;
          const xj = corners[j].x, yj = corners[j].y;
          const intersect = ((yi > point.y) !== (yj > point.y)) &&
            (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        if (inside) return obj.id;
      } else if (data.__kind__ === 'polyline') {
        const points = data.polyline.polyline.points;
        for (let j = 0; j < points.length - 1; j++) {
          if (isPointNearLine(point, points[j], points[j + 1])) {
            return obj.id;
          }
        }
      } else if (data.__kind__ === 'arc') {
        const { center, radius, startAngle, endAngle } = data.arc.arc;
        const distance = Math.sqrt(
          (point.x - center.x) ** 2 + (point.y - center.y) ** 2
        );
        if (Math.abs(distance - radius) < 5 / zoom) {
          const angle = Math.atan2(point.y - center.y, point.x - center.x);
          let normalizedAngle = angle;
          if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
          
          let start = startAngle;
          let end = endAngle;
          if (start < 0) start += 2 * Math.PI;
          if (end < 0) end += 2 * Math.PI;
          
          if (start <= end) {
            if (normalizedAngle >= start && normalizedAngle <= end) return obj.id;
          } else {
            if (normalizedAngle >= start || normalizedAngle <= end) return obj.id;
          }
        }
      }
    }
    return null;
  };

  // Find objects in rectangle
  const findObjectsInRect = (rect: { x: number; y: number; width: number; height: number }): string[] => {
    const selectedIds: string[] = [];
    const normalizedRect = {
      x: Math.min(rect.x, rect.x + rect.width),
      y: Math.min(rect.y, rect.y + rect.height),
      width: Math.abs(rect.width),
      height: Math.abs(rect.height),
    };

    for (const obj of objects) {
      const layer = layers.find(l => l.id === obj.layerId);
      if (!layer?.visible) continue;

      const bounds = getObjectBounds(obj);
      if (bounds) {
        if (bounds.x >= normalizedRect.x &&
            bounds.y >= normalizedRect.y &&
            bounds.x + bounds.width <= normalizedRect.x + normalizedRect.width &&
            bounds.y + bounds.height <= normalizedRect.y + normalizedRect.height) {
          selectedIds.push(obj.id);
        }
      }
    }
    return selectedIds;
  };

  // Update object properties - now updates objects state directly for real-time updates
  const updateObjectProperties = (objectId: string, updates: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    color?: string;
    fillColor?: string;
  }) => {
    const updatedObjects = objects.map(obj => {
      if (obj.id !== objectId) return obj;

      const data = obj.data;
      let newData: DrawingObject = data;

      if (data.__kind__ === 'line') {
        const dx = updates.x !== undefined ? updates.x - data.line.line.start.x : 0;
        const dy = updates.y !== undefined ? updates.y - data.line.line.start.y : 0;
        newData = {
          __kind__: 'line',
          line: {
            line: {
              start: { x: data.line.line.start.x + dx, y: data.line.line.start.y + dy },
              end: { x: data.line.line.end.x + dx, y: data.line.line.end.y + dy },
            },
            color: updates.color ? hexToColor(updates.color) : data.line.color,
            rotation: updates.rotation !== undefined ? (updates.rotation * Math.PI / 180) : data.line.rotation,
            layer: BigInt(obj.layerId),
          },
        };
      } else if (data.__kind__ === 'circle') {
        newData = {
          __kind__: 'circle',
          circle: {
            circle: {
              center: {
                x: updates.x !== undefined ? updates.x : data.circle.circle.center.x,
                y: updates.y !== undefined ? updates.y : data.circle.circle.center.y,
              },
              radius: updates.width !== undefined ? updates.width / 2 : data.circle.circle.radius,
            },
            color: updates.color ? hexToColor(updates.color) : data.circle.color,
            rotation: updates.rotation !== undefined ? (updates.rotation * Math.PI / 180) : data.circle.rotation,
            layer: BigInt(obj.layerId),
            fill: updates.fillColor ? hexToColor(updates.fillColor) : data.circle.fill,
          },
        };
      } else if (data.__kind__ === 'ellipse') {
        newData = {
          __kind__: 'ellipse',
          ellipse: {
            ellipse: {
              center: {
                x: updates.x !== undefined ? updates.x : data.ellipse.ellipse.center.x,
                y: updates.y !== undefined ? updates.y : data.ellipse.ellipse.center.y,
              },
              radiusX: updates.width !== undefined ? updates.width / 2 : data.ellipse.ellipse.radiusX,
              radiusY: updates.height !== undefined ? updates.height / 2 : data.ellipse.ellipse.radiusY,
            },
            color: updates.color ? hexToColor(updates.color) : data.ellipse.color,
            rotation: updates.rotation !== undefined ? (updates.rotation * Math.PI / 180) : data.ellipse.rotation,
            layer: BigInt(obj.layerId),
            fill: updates.fillColor ? hexToColor(updates.fillColor) : data.ellipse.fill,
          },
        };
      } else if (data.__kind__ === 'rectangle') {
        newData = {
          __kind__: 'rectangle',
          rectangle: {
            rectangle: {
              topLeft: {
                x: updates.x !== undefined ? updates.x : data.rectangle.rectangle.topLeft.x,
                y: updates.y !== undefined ? updates.y : data.rectangle.rectangle.topLeft.y,
              },
              width: updates.width !== undefined ? updates.width : data.rectangle.rectangle.width,
              height: updates.height !== undefined ? updates.height : data.rectangle.rectangle.height,
            },
            color: updates.color ? hexToColor(updates.color) : data.rectangle.color,
            rotation: updates.rotation !== undefined ? (updates.rotation * Math.PI / 180) : data.rectangle.rotation,
            layer: BigInt(obj.layerId),
            fill: updates.fillColor ? hexToColor(updates.fillColor) : data.rectangle.fill,
          },
        };
      } else if (data.__kind__ === 'octagon') {
        newData = {
          __kind__: 'octagon',
          octagon: {
            octagon: {
              center: {
                x: updates.x !== undefined ? updates.x : data.octagon.octagon.center.x,
                y: updates.y !== undefined ? updates.y : data.octagon.octagon.center.y,
              },
              size: updates.width !== undefined ? updates.width / 2 : data.octagon.octagon.size,
            },
            color: updates.color ? hexToColor(updates.color) : data.octagon.color,
            rotation: updates.rotation !== undefined ? (updates.rotation * Math.PI / 180) : data.octagon.rotation,
            layer: BigInt(obj.layerId),
            fill: updates.fillColor ? hexToColor(updates.fillColor) : data.octagon.fill,
          },
        };
      } else if (data.__kind__ === 'arc') {
        newData = {
          __kind__: 'arc',
          arc: {
            arc: {
              center: {
                x: updates.x !== undefined ? updates.x : data.arc.arc.center.x,
                y: updates.y !== undefined ? updates.y : data.arc.arc.center.y,
              },
              radius: updates.width !== undefined ? updates.width / 2 : data.arc.arc.radius,
              startAngle: data.arc.arc.startAngle,
              endAngle: data.arc.arc.endAngle,
            },
            color: updates.color ? hexToColor(updates.color) : data.arc.color,
            rotation: updates.rotation !== undefined ? (updates.rotation * Math.PI / 180) : data.arc.rotation,
            layer: BigInt(obj.layerId),
          },
        };
      }

      return { ...obj, data: newData };
    });

    // Update objects state directly for real-time updates
    setObjects(updatedObjects);
  };

  // Commit property changes to history (called when editing is complete)
  const commitPropertyChanges = () => {
    addToHistory([...objects]);
  };

  // Mirror selected objects
  const mirrorObjects = (axis: 'horizontal' | 'vertical') => {
    if (selectedObjectIds.length === 0) return;

    const selectedObjs = objects.filter(obj => selectedObjectIds.includes(obj.id));
    const newObjects: CADObject[] = [];

    selectedObjs.forEach(obj => {
      const data = obj.data;
      let newData: DrawingObject;

      if (data.__kind__ === 'line') {
        const centerX = (data.line.line.start.x + data.line.line.end.x) / 2;
        const centerY = (data.line.line.start.y + data.line.line.end.y) / 2;
        
        if (axis === 'horizontal') {
          newData = {
            __kind__: 'line',
            line: {
              line: {
                start: { x: 2 * centerX - data.line.line.start.x, y: data.line.line.start.y },
                end: { x: 2 * centerX - data.line.line.end.x, y: data.line.line.end.y },
              },
              color: data.line.color,
              rotation: data.line.rotation,
              layer: BigInt(obj.layerId),
            },
          };
        } else {
          newData = {
            __kind__: 'line',
            line: {
              line: {
                start: { x: data.line.line.start.x, y: 2 * centerY - data.line.line.start.y },
                end: { x: data.line.line.end.x, y: 2 * centerY - data.line.line.end.y },
              },
              color: data.line.color,
              rotation: data.line.rotation,
              layer: BigInt(obj.layerId),
            },
          };
        }
      } else {
        newData = data;
      }

      newObjects.push({
        id: `obj_${Date.now()}_${Math.random()}`,
        type: obj.type,
        data: newData,
        layerId: obj.layerId,
      });
    });

    addToHistory([...objects, ...newObjects]);
  };

  // Multi-copy selected objects
  const multiCopyObjects = (count: number, offsetX: number, offsetY: number) => {
    if (selectedObjectIds.length === 0 || count < 1) return;

    const selectedObjs = objects.filter(obj => selectedObjectIds.includes(obj.id));
    const newObjects: CADObject[] = [];

    for (let i = 1; i <= count; i++) {
      selectedObjs.forEach(obj => {
        const data = obj.data;
        let newData: DrawingObject;

        const dx = offsetX * i;
        const dy = offsetY * i;

        if (data.__kind__ === 'line') {
          newData = {
            __kind__: 'line',
            line: {
              line: {
                start: { x: data.line.line.start.x + dx, y: data.line.line.start.y + dy },
                end: { x: data.line.line.end.x + dx, y: data.line.line.end.y + dy },
              },
              color: data.line.color,
              rotation: data.line.rotation,
              layer: BigInt(obj.layerId),
            },
          };
        } else if (data.__kind__ === 'circle') {
          newData = {
            __kind__: 'circle',
            circle: {
              circle: {
                center: { x: data.circle.circle.center.x + dx, y: data.circle.circle.center.y + dy },
                radius: data.circle.circle.radius,
              },
              color: data.circle.color,
              rotation: data.circle.rotation,
              layer: BigInt(obj.layerId),
              fill: data.circle.fill,
            },
          };
        } else if (data.__kind__ === 'ellipse') {
          newData = {
            __kind__: 'ellipse',
            ellipse: {
              ellipse: {
                center: { x: data.ellipse.ellipse.center.x + dx, y: data.ellipse.ellipse.center.y + dy },
                radiusX: data.ellipse.ellipse.radiusX,
                radiusY: data.ellipse.ellipse.radiusY,
              },
              color: data.ellipse.color,
              rotation: data.ellipse.rotation,
              layer: BigInt(obj.layerId),
              fill: data.ellipse.fill,
            },
          };
        } else if (data.__kind__ === 'rectangle') {
          newData = {
            __kind__: 'rectangle',
            rectangle: {
              rectangle: {
                topLeft: { x: data.rectangle.rectangle.topLeft.x + dx, y: data.rectangle.rectangle.topLeft.y + dy },
                width: data.rectangle.rectangle.width,
                height: data.rectangle.rectangle.height,
              },
              color: data.rectangle.color,
              rotation: data.rectangle.rotation,
              layer: BigInt(obj.layerId),
              fill: data.rectangle.fill,
            },
          };
        } else if (data.__kind__ === 'octagon') {
          newData = {
            __kind__: 'octagon',
            octagon: {
              octagon: {
                center: { x: data.octagon.octagon.center.x + dx, y: data.octagon.octagon.center.y + dy },
                size: data.octagon.octagon.size,
              },
              color: data.octagon.color,
              rotation: data.octagon.rotation,
              layer: BigInt(obj.layerId),
              fill: data.octagon.fill,
            },
          };
        } else if (data.__kind__ === 'polyline') {
          newData = {
            __kind__: 'polyline',
            polyline: {
              polyline: {
                points: data.polyline.polyline.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
              },
              color: data.polyline.color,
              rotation: data.polyline.rotation,
              layer: BigInt(obj.layerId),
            },
          };
        } else if (data.__kind__ === 'arc') {
          newData = {
            __kind__: 'arc',
            arc: {
              arc: {
                center: { x: data.arc.arc.center.x + dx, y: data.arc.arc.center.y + dy },
                radius: data.arc.arc.radius,
                startAngle: data.arc.arc.startAngle,
                endAngle: data.arc.arc.endAngle,
              },
              color: data.arc.color,
              rotation: data.arc.rotation,
              layer: BigInt(obj.layerId),
            },
          };
        } else {
          newData = data;
        }

        newObjects.push({
          id: `obj_${Date.now()}_${Math.random()}`,
          type: obj.type,
          data: newData,
          layerId: obj.layerId,
        });
      });
    }

    addToHistory([...objects, ...newObjects]);
  };

  // Get selected object data for properties panel
  const getSelectedObjectData = () => {
    if (selectedObjectIds.length !== 1) return null;
    
    const obj = objects.find(o => o.id === selectedObjectIds[0]);
    if (!obj) return null;

    const data = obj.data;
    let x = 0, y = 0, width = 0, height = 0, rotation = 0, color = '#ffffff', fillColor = 'none';

    if (data.__kind__ === 'line') {
      x = data.line.line.start.x;
      y = data.line.line.start.y;
      width = Math.abs(data.line.line.end.x - data.line.line.start.x);
      height = Math.abs(data.line.line.end.y - data.line.line.start.y);
      rotation = data.line.rotation * 180 / Math.PI;
      color = colorToHex(data.line.color);
    } else if (data.__kind__ === 'circle') {
      x = data.circle.circle.center.x;
      y = data.circle.circle.center.y;
      width = data.circle.circle.radius * 2;
      height = data.circle.circle.radius * 2;
      rotation = data.circle.rotation * 180 / Math.PI;
      color = colorToHex(data.circle.color);
      fillColor = colorToHex(data.circle.fill);
    } else if (data.__kind__ === 'ellipse') {
      x = data.ellipse.ellipse.center.x;
      y = data.ellipse.ellipse.center.y;
      width = data.ellipse.ellipse.radiusX * 2;
      height = data.ellipse.ellipse.radiusY * 2;
      rotation = data.ellipse.rotation * 180 / Math.PI;
      color = colorToHex(data.ellipse.color);
      fillColor = colorToHex(data.ellipse.fill);
    } else if (data.__kind__ === 'rectangle') {
      x = data.rectangle.rectangle.topLeft.x;
      y = data.rectangle.rectangle.topLeft.y;
      width = data.rectangle.rectangle.width;
      height = data.rectangle.rectangle.height;
      rotation = data.rectangle.rotation * 180 / Math.PI;
      color = colorToHex(data.rectangle.color);
      fillColor = colorToHex(data.rectangle.fill);
    } else if (data.__kind__ === 'octagon') {
      x = data.octagon.octagon.center.x;
      y = data.octagon.octagon.center.y;
      width = data.octagon.octagon.size * 2;
      height = data.octagon.octagon.size * 2;
      rotation = data.octagon.rotation * 180 / Math.PI;
      color = colorToHex(data.octagon.color);
      fillColor = colorToHex(data.octagon.fill);
    } else if (data.__kind__ === 'polyline') {
      const bounds = getObjectBounds(obj);
      if (bounds) {
        x = bounds.x;
        y = bounds.y;
        width = bounds.width;
        height = bounds.height;
      }
      rotation = data.polyline.rotation * 180 / Math.PI;
      color = colorToHex(data.polyline.color);
    } else if (data.__kind__ === 'arc') {
      x = data.arc.arc.center.x;
      y = data.arc.arc.center.y;
      width = data.arc.arc.radius * 2;
      height = data.arc.arc.radius * 2;
      rotation = data.arc.rotation * 180 / Math.PI;
      color = colorToHex(data.arc.color);
    }

    return { id: obj.id, type: obj.type, x, y, width, height, rotation, color, fillColor };
  };

  // Mouse event handlers
  const handleMouseDown = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let point = screenToCanvas(e.clientX, e.clientY);
    const state = drawingStateRef.current;

    // Explode tool
    if (tool === 'explode') {
      explodeObjects();
      return;
    }

    // Pan tool
    if (tool === 'pan') {
      state.isPanning = true;
      state.panStart = { x: e.clientX, y: e.clientY };
      state.panStartOffset = { ...pan };
      canvas.style.cursor = 'grabbing';
      return;
    }

    // Arc Edit tool - now works with rectangle and octagon edges
    if (tool === 'arcedit') {
      if (!state.arcEditState.isDefiningArc) {
        // First click: select an edge (line, rectangle edge, or octagon edge)
        const edge = findEdgeAtPoint(point);
        if (edge) {
          state.arcEditState.selectedEdge = edge;
          state.arcEditState.isDefiningArc = true;
          setSelectedObjectIds([edge.objectId]);
          renderCanvas();
        }
      } else {
        // Second click: define arc center point
        const snap = findSnapPoint(point);
        if (snap) {
          point = snap.point;
        }
        state.arcEditState.arcCenter = point;
        
        // Convert edge to arc
        if (state.arcEditState.selectedEdge) {
          const edge = state.arcEditState.selectedEdge;
          const obj = objects.find(o => o.id === edge.objectId);
          
          if (obj) {
            const start = edge.start;
            const end = edge.end;
            const center = point;
            
            // Calculate radius and angles
            const radius = Math.sqrt((start.x - center.x) ** 2 + (start.y - center.y) ** 2);
            const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
            const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
            
            // Get color from original object
            let color = Color.white;
            let rotation = 0;
            let layerId = obj.layerId;
            
            if (obj.data.__kind__ === 'line') {
              color = obj.data.line.color;
              rotation = obj.data.line.rotation;
            } else if (obj.data.__kind__ === 'rectangle') {
              color = obj.data.rectangle.color;
              rotation = obj.data.rectangle.rotation;
            } else if (obj.data.__kind__ === 'octagon') {
              color = obj.data.octagon.color;
              rotation = obj.data.octagon.rotation;
            }
            
            // Create arc object
            const arcObject: CADObject = {
              id: `obj_${Date.now()}`,
              type: 'arc',
              data: {
                __kind__: 'arc',
                arc: {
                  arc: {
                    center,
                    radius,
                    startAngle,
                    endAngle,
                  },
                  color,
                  rotation,
                  layer: BigInt(layerId),
                },
              },
              layerId,
            };
            
            // Add arc to objects (keep original object)
            addToHistory([...objects, arcObject]);
          }
        }
        
        // Reset arc edit state
        state.arcEditState.selectedEdge = null;
        state.arcEditState.arcCenter = null;
        state.arcEditState.isDefiningArc = false;
        renderCanvas();
      }
      return;
    }

    // Apply snapping for drawing tools
    if (tool !== 'select' && tool !== 'measure') {
      const snap = findSnapPoint(point);
      if (snap) {
        point = snap.point;
        state.snapPoint = snap;
      }
    }

    if (tool === 'measure') {
      const snap = findSnapPoint(point);
      if (snap) {
        point = snap.point;
      }
      
      state.measurementPoints.push(point);
      
      if (state.measurementPoints.length === 2) {
        const distance = calculateDistance(state.measurementPoints[0], state.measurementPoints[1]);
        state.measurements.push({
          type: 'distance',
          points: [...state.measurementPoints],
          value: distance,
        });
        state.measurementPoints = [];
      } else if (state.measurementPoints.length === 3) {
        const angle = calculateAngle(
          state.measurementPoints[0],
          state.measurementPoints[1],
          state.measurementPoints[2]
        );
        state.measurements.push({
          type: 'angle',
          points: [...state.measurementPoints],
          value: angle,
        });
        state.measurementPoints = [];
      }
      
      renderCanvas();
    } else if (tool === 'select') {
      const objectId = findObjectAtPoint(point);
      if (objectId) {
        if (e.shiftKey) {
          setSelectedObjectIds(prev => 
            prev.includes(objectId) ? prev.filter(id => id !== objectId) : [...prev, objectId]
          );
        } else {
          setSelectedObjectIds([objectId]);
        }
      } else {
        state.isRectangleSelecting = true;
        state.rectangleSelectStart = point;
        state.currentPoint = point;
        if (!e.shiftKey) {
          setSelectedObjectIds([]);
        }
      }
    } else if (tool === 'move' || tool === 'copy' || tool === 'rotate' || tool === 'scale') {
      if (selectedObjectIds.length > 0) {
        state.isDragging = true;
        state.dragStart = point;
        state.originalObjectsData.clear();
        selectedObjectIds.forEach(id => {
          const obj = objects.find(o => o.id === id);
          if (obj) {
            state.originalObjectsData.set(id, obj.data);
          }
        });
      }
    } else if (tool === 'polyline') {
      state.polylinePoints.push(point);
    } else {
      state.isDrawing = true;
      state.startPoint = point;
      state.currentPoint = point;
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = drawingStateRef.current;

    // Pan tool
    if (state.isPanning && state.panStart && state.panStartOffset) {
      const dx = e.clientX - state.panStart.x;
      const dy = e.clientY - state.panStart.y;
      setPan({
        x: state.panStartOffset.x + dx,
        y: state.panStartOffset.y + dy,
      });
      return;
    }

    let point = screenToCanvas(e.clientX, e.clientY);

    // Apply snapping for drawing tools
    if (tool !== 'select' && tool !== 'measure' && tool !== 'arcedit' && tool !== 'explode') {
      const snap = findSnapPoint(point);
      if (snap) {
        point = snap.point;
        state.snapPoint = snap;
      } else {
        state.snapPoint = null;
      }
    } else if (tool === 'measure' || tool === 'arcedit') {
      const snap = findSnapPoint(point);
      state.snapPoint = snap || null;
    }

    if (state.isRectangleSelecting && state.rectangleSelectStart) {
      state.currentPoint = point;
      renderCanvas();
    } else if (state.isDrawing) {
      state.currentPoint = point;
      renderCanvas();
    } else if (state.isDragging && selectedObjectIds.length > 0 && state.dragStart) {
      const dx = point.x - state.dragStart.x;
      const dy = point.y - state.dragStart.y;

      const updatedObjects = objects.map((obj) => {
        if (!selectedObjectIds.includes(obj.id)) return obj;

        const originalData = state.originalObjectsData.get(obj.id);
        if (!originalData) return obj;

        let newData: DrawingObject;

        if (tool === 'move' || tool === 'copy') {
          if (originalData.__kind__ === 'line') {
            newData = {
              __kind__: 'line',
              line: {
                line: {
                  start: { x: originalData.line.line.start.x + dx, y: originalData.line.line.start.y + dy },
                  end: { x: originalData.line.line.end.x + dx, y: originalData.line.line.end.y + dy },
                },
                color: originalData.line.color,
                rotation: originalData.line.rotation,
                layer: originalData.line.layer,
              },
            };
          } else if (originalData.__kind__ === 'circle') {
            newData = {
              __kind__: 'circle',
              circle: {
                circle: {
                  center: { x: originalData.circle.circle.center.x + dx, y: originalData.circle.circle.center.y + dy },
                  radius: originalData.circle.circle.radius,
                },
                color: originalData.circle.color,
                rotation: originalData.circle.rotation,
                layer: originalData.circle.layer,
                fill: originalData.circle.fill,
              },
            };
          } else if (originalData.__kind__ === 'ellipse') {
            newData = {
              __kind__: 'ellipse',
              ellipse: {
                ellipse: {
                  center: { x: originalData.ellipse.ellipse.center.x + dx, y: originalData.ellipse.ellipse.center.y + dy },
                  radiusX: originalData.ellipse.ellipse.radiusX,
                  radiusY: originalData.ellipse.ellipse.radiusY,
                },
                color: originalData.ellipse.color,
                rotation: originalData.ellipse.rotation,
                layer: originalData.ellipse.layer,
                fill: originalData.ellipse.fill,
              },
            };
          } else if (originalData.__kind__ === 'rectangle') {
            newData = {
              __kind__: 'rectangle',
              rectangle: {
                rectangle: {
                  topLeft: { x: originalData.rectangle.rectangle.topLeft.x + dx, y: originalData.rectangle.rectangle.topLeft.y + dy },
                  width: originalData.rectangle.rectangle.width,
                  height: originalData.rectangle.rectangle.height,
                },
                color: originalData.rectangle.color,
                rotation: originalData.rectangle.rotation,
                layer: originalData.rectangle.layer,
                fill: originalData.rectangle.fill,
              },
            };
          } else if (originalData.__kind__ === 'octagon') {
            newData = {
              __kind__: 'octagon',
              octagon: {
                octagon: {
                  center: { x: originalData.octagon.octagon.center.x + dx, y: originalData.octagon.octagon.center.y + dy },
                  size: originalData.octagon.octagon.size,
                },
                color: originalData.octagon.color,
                rotation: originalData.octagon.rotation,
                layer: originalData.octagon.layer,
                fill: originalData.octagon.fill,
              },
            };
          } else if (originalData.__kind__ === 'polyline') {
            newData = {
              __kind__: 'polyline',
              polyline: {
                polyline: {
                  points: originalData.polyline.polyline.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
                },
                color: originalData.polyline.color,
                rotation: originalData.polyline.rotation,
                layer: originalData.polyline.layer,
              },
            };
          } else if (originalData.__kind__ === 'arc') {
            newData = {
              __kind__: 'arc',
              arc: {
                arc: {
                  center: { x: originalData.arc.arc.center.x + dx, y: originalData.arc.arc.center.y + dy },
                  radius: originalData.arc.arc.radius,
                  startAngle: originalData.arc.arc.startAngle,
                  endAngle: originalData.arc.arc.endAngle,
                },
                color: originalData.arc.color,
                rotation: originalData.arc.rotation,
                layer: originalData.arc.layer,
              },
            };
          } else {
            newData = originalData;
          }
        } else if (tool === 'scale') {
          const scaleFactor = 1 + dx / 100;
          if (originalData.__kind__ === 'circle') {
            newData = {
              __kind__: 'circle',
              circle: {
                circle: {
                  center: originalData.circle.circle.center,
                  radius: originalData.circle.circle.radius * scaleFactor,
                },
                color: originalData.circle.color,
                rotation: originalData.circle.rotation,
                layer: originalData.circle.layer,
                fill: originalData.circle.fill,
              },
            };
          } else if (originalData.__kind__ === 'ellipse') {
            newData = {
              __kind__: 'ellipse',
              ellipse: {
                ellipse: {
                  center: originalData.ellipse.ellipse.center,
                  radiusX: originalData.ellipse.ellipse.radiusX * scaleFactor,
                  radiusY: originalData.ellipse.ellipse.radiusY * scaleFactor,
                },
                color: originalData.ellipse.color,
                rotation: originalData.ellipse.rotation,
                layer: originalData.ellipse.layer,
                fill: originalData.ellipse.fill,
              },
            };
          } else if (originalData.__kind__ === 'rectangle') {
            newData = {
              __kind__: 'rectangle',
              rectangle: {
                rectangle: {
                  topLeft: originalData.rectangle.rectangle.topLeft,
                  width: originalData.rectangle.rectangle.width * scaleFactor,
                  height: originalData.rectangle.rectangle.height * scaleFactor,
                },
                color: originalData.rectangle.color,
                rotation: originalData.rectangle.rotation,
                layer: originalData.rectangle.layer,
                fill: originalData.rectangle.fill,
              },
            };
          } else if (originalData.__kind__ === 'octagon') {
            newData = {
              __kind__: 'octagon',
              octagon: {
                octagon: {
                  center: originalData.octagon.octagon.center,
                  size: originalData.octagon.octagon.size * scaleFactor,
                },
                color: originalData.octagon.color,
                rotation: originalData.octagon.rotation,
                layer: originalData.octagon.layer,
                fill: originalData.octagon.fill,
              },
            };
          } else {
            newData = originalData;
          }
        } else if (tool === 'rotate') {
          const angle = dx / 50;
          if (originalData.__kind__ === 'line') {
            const centerX = (originalData.line.line.start.x + originalData.line.line.end.x) / 2;
            const centerY = (originalData.line.line.start.y + originalData.line.line.end.y) / 2;
            const rotatePoint = (p: Point) => ({
              x: centerX + (p.x - centerX) * Math.cos(angle) - (p.y - centerY) * Math.sin(angle),
              y: centerY + (p.x - centerX) * Math.sin(angle) + (p.y - centerY) * Math.cos(angle),
            });
            newData = {
              __kind__: 'line',
              line: {
                line: {
                  start: rotatePoint(originalData.line.line.start),
                  end: rotatePoint(originalData.line.line.end),
                },
                color: originalData.line.color,
                rotation: originalData.line.rotation,
                layer: originalData.line.layer,
              },
            };
          } else {
            newData = originalData;
          }
        } else {
          newData = originalData;
        }

        return { ...obj, data: newData };
      });

      setObjects(updatedObjects);
      renderCanvas();
    } else if (tool === 'polyline' && state.polylinePoints.length > 0) {
      state.currentPoint = point;
      renderCanvas();
    } else if (tool === 'measure' && state.measurementPoints.length > 0) {
      state.currentPoint = point;
      renderCanvas();
    } else if (tool === 'arcedit' && state.arcEditState.isDefiningArc) {
      state.currentPoint = point;
      renderCanvas();
    } else {
      renderCanvas();
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const state = drawingStateRef.current;

    // Pan tool
    if (state.isPanning) {
      state.isPanning = false;
      state.panStart = null;
      state.panStartOffset = null;
      canvas.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
      return;
    }

    let point = screenToCanvas(e.clientX, e.clientY);

    // Apply snapping for drawing tools
    if (tool !== 'select' && tool !== 'measure' && tool !== 'arcedit' && tool !== 'explode') {
      const snap = findSnapPoint(point);
      if (snap) {
        point = snap.point;
      }
    }

    if (state.isRectangleSelecting && state.rectangleSelectStart) {
      const rect = {
        x: state.rectangleSelectStart.x,
        y: state.rectangleSelectStart.y,
        width: point.x - state.rectangleSelectStart.x,
        height: point.y - state.rectangleSelectStart.y,
      };
      const selectedIds = findObjectsInRect(rect);
      if (e.shiftKey) {
        setSelectedObjectIds(prev => [...new Set([...prev, ...selectedIds])]);
      } else {
        setSelectedObjectIds(selectedIds);
      }
      state.isRectangleSelecting = false;
      state.rectangleSelectStart = null;
      state.currentPoint = null;
      state.snapPoint = null;
      renderCanvas();
    } else if (state.isDrawing && state.startPoint && state.currentPoint) {
      const newObject: CADObject = {
        id: `obj_${Date.now()}`,
        type: tool as any,
        data: createDrawingObject(tool, state.startPoint, state.currentPoint),
        layerId: activeLayerId,
      };
      addToHistory([...objects, newObject]);
      state.isDrawing = false;
      state.startPoint = null;
      state.currentPoint = null;
      state.snapPoint = null;
    } else if (state.isDragging) {
      if (tool === 'copy' && selectedObjectIds.length > 0) {
        const newObjects: CADObject[] = [];
        selectedObjectIds.forEach(id => {
          const selectedObj = objects.find((o) => o.id === id);
          if (selectedObj) {
            const newObject: CADObject = {
              id: `obj_${Date.now()}_${Math.random()}`,
              type: selectedObj.type,
              data: selectedObj.data,
              layerId: selectedObj.layerId,
            };
            newObjects.push(newObject);
          }
        });
        addToHistory([...objects, ...newObjects]);
        setSelectedObjectIds(newObjects.map(o => o.id));
      } else {
        addToHistory([...objects]);
      }
      state.isDragging = false;
      state.dragStart = null;
      state.originalObjectsData.clear();
    }
  };

  const handleDoubleClick = (e: MouseEvent) => {
    const state = drawingStateRef.current;
    if (tool === 'polyline' && state.polylinePoints.length > 1) {
      const newObject: CADObject = {
        id: `obj_${Date.now()}`,
        type: 'polyline',
        data: {
          __kind__: 'polyline',
          polyline: {
            polyline: { points: [...state.polylinePoints] },
            color: Color.white,
            rotation: 0,
            layer: BigInt(activeLayerId),
          },
        },
        layerId: activeLayerId,
      };
      addToHistory([...objects, newObject]);
      state.polylinePoints = [];
      state.currentPoint = null;
      state.snapPoint = null;
    }
  };

  const createDrawingObject = (tool: string, start: Point, end: Point): DrawingObject => {
    if (tool === 'line') {
      return {
        __kind__: 'line',
        line: {
          line: { start, end },
          color: Color.white,
          rotation: 0,
          layer: BigInt(activeLayerId),
        },
      };
    } else if (tool === 'circle') {
      const radius = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      return {
        __kind__: 'circle',
        circle: {
          circle: { center: start, radius },
          color: Color.white,
          rotation: 0,
          layer: BigInt(activeLayerId),
          fill: Color.green,
        },
      };
    } else if (tool === 'ellipse') {
      const radiusX = Math.abs(end.x - start.x);
      const radiusY = Math.abs(end.y - start.y);
      return {
        __kind__: 'ellipse',
        ellipse: {
          ellipse: { center: start, radiusX, radiusY },
          color: Color.white,
          rotation: 0,
          layer: BigInt(activeLayerId),
          fill: Color.none,
        },
      };
    } else if (tool === 'rectangle') {
      return {
        __kind__: 'rectangle',
        rectangle: {
          rectangle: {
            topLeft: { x: Math.min(start.x, end.x), y: Math.min(start.y, end.y) },
            width: Math.abs(end.x - start.x),
            height: Math.abs(end.y - start.y),
          },
          color: Color.white,
          rotation: 0,
          layer: BigInt(activeLayerId),
          fill: Color.green,
        },
      };
    } else if (tool === 'octagon') {
      const size = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
      return {
        __kind__: 'octagon',
        octagon: {
          octagon: { center: start, size },
          color: Color.white,
          rotation: 0,
          layer: BigInt(activeLayerId),
          fill: Color.none,
        },
      };
    }
    return {
      __kind__: 'line',
      line: {
        line: { start, end },
        color: Color.white,
        rotation: 0,
        layer: BigInt(activeLayerId),
      },
    };
  };

  // Render canvas with rotation support and unit-aware measurements
  const renderCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 0.5 / zoom;
    const gridSize = 50;
    for (let x = 0; x < canvas.width / zoom; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height / zoom);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height / zoom; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width / zoom, y);
      ctx.stroke();
    }

    objects.forEach((obj) => {
      const layer = layers.find(l => l.id === obj.layerId);
      if (!layer?.visible) return;
      
      const isSelected = selectedObjectIds.includes(obj.id);
      const data = obj.data;
      
      let objectColor = '#ffffff';
      let rotation = 0;
      let fillColor = 'none';
      
      if (data.__kind__ === 'line') {
        objectColor = colorToHex(data.line.color);
        rotation = data.line.rotation;
      } else if (data.__kind__ === 'circle') {
        objectColor = colorToHex(data.circle.color);
        rotation = data.circle.rotation;
        fillColor = colorToHex(data.circle.fill);
      } else if (data.__kind__ === 'ellipse') {
        objectColor = colorToHex(data.ellipse.color);
        rotation = data.ellipse.rotation;
        fillColor = colorToHex(data.ellipse.fill);
      } else if (data.__kind__ === 'rectangle') {
        objectColor = colorToHex(data.rectangle.color);
        rotation = data.rectangle.rotation;
        fillColor = colorToHex(data.rectangle.fill);
      } else if (data.__kind__ === 'octagon') {
        objectColor = colorToHex(data.octagon.color);
        rotation = data.octagon.rotation;
        fillColor = colorToHex(data.octagon.fill);
      } else if (data.__kind__ === 'polyline') {
        objectColor = colorToHex(data.polyline.color);
        rotation = data.polyline.rotation;
      } else if (data.__kind__ === 'arc') {
        objectColor = colorToHex(data.arc.color);
        rotation = data.arc.rotation;
      }

      ctx.strokeStyle = isSelected ? '#00ff00' : objectColor;
      ctx.lineWidth = (isSelected ? 2.5 : 1.5) / zoom;

      // Apply rotation if needed
      if (rotation !== 0) {
        ctx.save();
        
        // Get center point for rotation
        let centerX = 0, centerY = 0;
        if (data.__kind__ === 'line') {
          centerX = (data.line.line.start.x + data.line.line.end.x) / 2;
          centerY = (data.line.line.start.y + data.line.line.end.y) / 2;
        } else if (data.__kind__ === 'circle') {
          centerX = data.circle.circle.center.x;
          centerY = data.circle.circle.center.y;
        } else if (data.__kind__ === 'ellipse') {
          centerX = data.ellipse.ellipse.center.x;
          centerY = data.ellipse.ellipse.center.y;
        } else if (data.__kind__ === 'rectangle') {
          centerX = data.rectangle.rectangle.topLeft.x + data.rectangle.rectangle.width / 2;
          centerY = data.rectangle.rectangle.topLeft.y + data.rectangle.rectangle.height / 2;
        } else if (data.__kind__ === 'octagon') {
          centerX = data.octagon.octagon.center.x;
          centerY = data.octagon.octagon.center.y;
        } else if (data.__kind__ === 'arc') {
          centerX = data.arc.arc.center.x;
          centerY = data.arc.arc.center.y;
        }
        
        ctx.translate(centerX, centerY);
        ctx.rotate(rotation);
        ctx.translate(-centerX, -centerY);
      }

      // Draw fill for closed shapes
      if (fillColor !== 'none' && (data.__kind__ === 'circle' || data.__kind__ === 'ellipse' || 
          data.__kind__ === 'rectangle' || data.__kind__ === 'octagon')) {
        ctx.fillStyle = fillColor;
        
        if (data.__kind__ === 'circle') {
          ctx.beginPath();
          ctx.arc(data.circle.circle.center.x, data.circle.circle.center.y, data.circle.circle.radius, 0, Math.PI * 2);
          ctx.fill();
        } else if (data.__kind__ === 'ellipse') {
          ctx.beginPath();
          ctx.ellipse(
            data.ellipse.ellipse.center.x,
            data.ellipse.ellipse.center.y,
            data.ellipse.ellipse.radiusX,
            data.ellipse.ellipse.radiusY,
            0, 0, Math.PI * 2
          );
          ctx.fill();
        } else if (data.__kind__ === 'rectangle') {
          ctx.fillRect(
            data.rectangle.rectangle.topLeft.x,
            data.rectangle.rectangle.topLeft.y,
            data.rectangle.rectangle.width,
            data.rectangle.rectangle.height
          );
        } else if (data.__kind__ === 'octagon') {
          const corners = getOctagonCorners(data.octagon.octagon.center, data.octagon.octagon.size);
          ctx.beginPath();
          corners.forEach((corner, i) => {
            if (i === 0) ctx.moveTo(corner.x, corner.y);
            else ctx.lineTo(corner.x, corner.y);
          });
          ctx.closePath();
          ctx.fill();
        }
      }

      // Draw outline
      if (data.__kind__ === 'line') {
        ctx.beginPath();
        ctx.moveTo(data.line.line.start.x, data.line.line.start.y);
        ctx.lineTo(data.line.line.end.x, data.line.line.end.y);
        ctx.stroke();
      } else if (data.__kind__ === 'circle') {
        ctx.beginPath();
        ctx.arc(data.circle.circle.center.x, data.circle.circle.center.y, data.circle.circle.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (data.__kind__ === 'ellipse') {
        ctx.beginPath();
        ctx.ellipse(
          data.ellipse.ellipse.center.x,
          data.ellipse.ellipse.center.y,
          data.ellipse.ellipse.radiusX,
          data.ellipse.ellipse.radiusY,
          0, 0, Math.PI * 2
        );
        ctx.stroke();
      } else if (data.__kind__ === 'rectangle') {
        ctx.strokeRect(
          data.rectangle.rectangle.topLeft.x,
          data.rectangle.rectangle.topLeft.y,
          data.rectangle.rectangle.width,
          data.rectangle.rectangle.height
        );
      } else if (data.__kind__ === 'octagon') {
        const corners = getOctagonCorners(data.octagon.octagon.center, data.octagon.octagon.size);
        ctx.beginPath();
        corners.forEach((corner, i) => {
          if (i === 0) ctx.moveTo(corner.x, corner.y);
          else ctx.lineTo(corner.x, corner.y);
        });
        ctx.closePath();
        ctx.stroke();
      } else if (data.__kind__ === 'polyline') {
        ctx.beginPath();
        data.polyline.polyline.points.forEach((p, i) => {
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.stroke();
      } else if (data.__kind__ === 'arc') {
        ctx.beginPath();
        ctx.arc(
          data.arc.arc.center.x,
          data.arc.arc.center.y,
          data.arc.arc.radius,
          data.arc.arc.startAngle,
          data.arc.arc.endAngle
        );
        ctx.stroke();
      }

      if (rotation !== 0) {
        ctx.restore();
      }
    });

    const state = drawingStateRef.current;
    const activeLayer = layers.find(l => l.id === activeLayerId);
    
    if (state.isRectangleSelecting && state.rectangleSelectStart && state.currentPoint) {
      ctx.strokeStyle = '#00ff00';
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.strokeRect(
        state.rectangleSelectStart.x,
        state.rectangleSelectStart.y,
        state.currentPoint.x - state.rectangleSelectStart.x,
        state.currentPoint.y - state.rectangleSelectStart.y
      );
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    } else if (state.isDrawing && state.startPoint && state.currentPoint) {
      ctx.strokeStyle = activeLayer?.color || '#ffffff';
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);

      if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(state.startPoint.x, state.startPoint.y);
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
        ctx.stroke();
      } else if (tool === 'circle') {
        const radius = Math.sqrt(
          (state.currentPoint.x - state.startPoint.x) ** 2 +
            (state.currentPoint.y - state.startPoint.y) ** 2
        );
        ctx.beginPath();
        ctx.arc(state.startPoint.x, state.startPoint.y, radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'ellipse') {
        const radiusX = Math.abs(state.currentPoint.x - state.startPoint.x);
        const radiusY = Math.abs(state.currentPoint.y - state.startPoint.y);
        ctx.beginPath();
        ctx.ellipse(state.startPoint.x, state.startPoint.y, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'rectangle') {
        ctx.strokeRect(
          state.startPoint.x,
          state.startPoint.y,
          state.currentPoint.x - state.startPoint.x,
          state.currentPoint.y - state.startPoint.y
        );
      } else if (tool === 'octagon') {
        const size = Math.sqrt(
          (state.currentPoint.x - state.startPoint.x) ** 2 +
            (state.currentPoint.y - state.startPoint.y) ** 2
        );
        const corners = getOctagonCorners(state.startPoint, size);
        ctx.beginPath();
        corners.forEach((corner, i) => {
          if (i === 0) ctx.moveTo(corner.x, corner.y);
          else ctx.lineTo(corner.x, corner.y);
        });
        ctx.closePath();
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    if (tool === 'polyline' && state.polylinePoints.length > 0) {
      ctx.strokeStyle = activeLayer?.color || '#ffffff';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      state.polylinePoints.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (state.currentPoint) {
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
      }
      ctx.stroke();

      ctx.fillStyle = activeLayer?.color || '#ffffff';
      state.polylinePoints.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3 / zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Arc edit preview
    if (tool === 'arcedit' && state.arcEditState.isDefiningArc && state.arcEditState.selectedEdge && state.currentPoint) {
      const edge = state.arcEditState.selectedEdge;
      const start = edge.start;
      const end = edge.end;
      const center = state.currentPoint;
      
      const radius = Math.sqrt((start.x - center.x) ** 2 + (start.y - center.y) ** 2);
      const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
      const endAngle = Math.atan2(end.y - center.y, end.x - center.x);
      
      ctx.strokeStyle = '#ffff00';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, startAngle, endAngle);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draw center point
      ctx.fillStyle = '#ffff00';
      ctx.beginPath();
      ctx.arc(center.x, center.y, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalAlpha = 1;
    }

    // Render measurements with unit conversion
    ctx.strokeStyle = '#ffff00';
    ctx.fillStyle = '#ffff00';
    ctx.lineWidth = 2 / zoom;
    ctx.font = `${14 / zoom}px sans-serif`;

    state.measurements.forEach((measurement) => {
      if (measurement.type === 'distance') {
        const [p1, p2] = measurement.points;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        
        // Convert distance to selected unit
        const displayValue = convertFromPixels 
          ? convertFromPixels(measurement.value)
          : measurement.value;
        const unitLabel = getUnitLabel ? getUnitLabel() : 'px';
        
        ctx.fillText(`${displayValue.toFixed(2)} ${unitLabel}`, midX, midY - 10 / zoom);
      } else if (measurement.type === 'angle') {
        const [p1, p2, p3] = measurement.points;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.stroke();

        const radius = 30 / zoom;
        const angle1 = Math.atan2(p1.y - p2.y, p1.x - p2.x);
        const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
        ctx.beginPath();
        ctx.arc(p2.x, p2.y, radius, angle1, angle2);
        ctx.stroke();

        ctx.fillText(`${measurement.value.toFixed(2)}°`, p2.x + radius, p2.y);
      }
    });

    // Render measurement preview with unit conversion
    if (tool === 'measure' && state.measurementPoints.length > 0) {
      ctx.strokeStyle = '#ffff00';
      ctx.fillStyle = '#ffff00';
      ctx.lineWidth = 2 / zoom;
      ctx.setLineDash([5 / zoom, 5 / zoom]);

      if (state.measurementPoints.length === 1 && state.currentPoint) {
        ctx.beginPath();
        ctx.moveTo(state.measurementPoints[0].x, state.measurementPoints[0].y);
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
        ctx.stroke();

        const dist = calculateDistance(state.measurementPoints[0], state.currentPoint);
        const midX = (state.measurementPoints[0].x + state.currentPoint.x) / 2;
        const midY = (state.measurementPoints[0].y + state.currentPoint.y) / 2;
        
        // Convert distance to selected unit
        const displayValue = convertFromPixels 
          ? convertFromPixels(dist)
          : dist;
        const unitLabel = getUnitLabel ? getUnitLabel() : 'px';
        
        ctx.fillText(`${displayValue.toFixed(2)} ${unitLabel}`, midX, midY - 10 / zoom);
      } else if (state.measurementPoints.length === 2 && state.currentPoint) {
        ctx.beginPath();
        ctx.moveTo(state.measurementPoints[0].x, state.measurementPoints[0].y);
        ctx.lineTo(state.measurementPoints[1].x, state.measurementPoints[1].y);
        ctx.lineTo(state.currentPoint.x, state.currentPoint.y);
        ctx.stroke();

        const angle = calculateAngle(state.measurementPoints[0], state.measurementPoints[1], state.currentPoint);
        const radius = 30 / zoom;
        const angle1 = Math.atan2(state.measurementPoints[0].y - state.measurementPoints[1].y, state.measurementPoints[0].x - state.measurementPoints[1].x);
        const angle2 = Math.atan2(state.currentPoint.y - state.measurementPoints[1].y, state.currentPoint.x - state.measurementPoints[1].x);
        ctx.beginPath();
        ctx.arc(state.measurementPoints[1].x, state.measurementPoints[1].y, radius, angle1, angle2);
        ctx.stroke();

        ctx.fillText(`${angle.toFixed(2)}°`, state.measurementPoints[1].x + radius, state.measurementPoints[1].y);
      }

      ctx.setLineDash([]);

      state.measurementPoints.forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4 / zoom, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Render snap indicator
    if (state.snapPoint) {
      ctx.strokeStyle = '#00ffff';
      ctx.fillStyle = '#00ffff';
      ctx.lineWidth = 2 / zoom;
      
      const size = 8 / zoom;
      ctx.beginPath();
      ctx.moveTo(state.snapPoint.point.x - size, state.snapPoint.point.y);
      ctx.lineTo(state.snapPoint.point.x + size, state.snapPoint.point.y);
      ctx.moveTo(state.snapPoint.point.x, state.snapPoint.point.y - size);
      ctx.lineTo(state.snapPoint.point.x, state.snapPoint.point.y + size);
      ctx.stroke();

      ctx.font = `${10 / zoom}px sans-serif`;
      ctx.fillText(state.snapPoint.type, state.snapPoint.point.x + 10 / zoom, state.snapPoint.point.y - 10 / zoom);
    }

    ctx.restore();
  };

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete key
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectIds.length > 0) {
          deleteSelectedObjects();
          e.preventDefault();
        }
        return;
      }

      // Pan with keyboard (arrow keys and WASD)
      if (tool === 'pan') {
        const panDistance = 20;
        let dx = 0, dy = 0;

        switch (e.key.toLowerCase()) {
          case 'arrowup':
          case 'w':
            dy = panDistance;
            e.preventDefault();
            break;
          case 'arrowdown':
          case 's':
            dy = -panDistance;
            e.preventDefault();
            break;
          case 'arrowleft':
          case 'a':
            dx = panDistance;
            e.preventDefault();
            break;
          case 'arrowright':
          case 'd':
            dx = -panDistance;
            e.preventDefault();
            break;
          default:
            return;
        }

        setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        return;
      }

      // Escape key to cancel arc edit
      if (e.key === 'Escape') {
        if (tool === 'arcedit') {
          drawingStateRef.current.arcEditState.selectedEdge = null;
          drawingStateRef.current.arcEditState.arcCenter = null;
          drawingStateRef.current.arcEditState.isDefiningArc = false;
          setSelectedObjectIds([]);
          renderCanvas();
        } else if (tool === 'measure') {
          drawingStateRef.current.measurementPoints = [];
          drawingStateRef.current.measurements = [];
          renderCanvas();
        }
        return;
      }

      // Move selected objects with arrow keys
      if (selectedObjectIds.length > 0) {
        const moveDistance = 5;
        let dx = 0, dy = 0;

        switch (e.key) {
          case 'ArrowUp':
            dy = -moveDistance;
            e.preventDefault();
            break;
          case 'ArrowDown':
            dy = moveDistance;
            e.preventDefault();
            break;
          case 'ArrowLeft':
            dx = -moveDistance;
            e.preventDefault();
            break;
          case 'ArrowRight':
            dx = moveDistance;
            e.preventDefault();
            break;
          default:
            return;
        }

        const updatedObjects = objects.map(obj => {
          if (!selectedObjectIds.includes(obj.id)) return obj;

          const data = obj.data;
          let newData: DrawingObject;

          if (data.__kind__ === 'line') {
            newData = {
              __kind__: 'line',
              line: {
                line: {
                  start: { x: data.line.line.start.x + dx, y: data.line.line.start.y + dy },
                  end: { x: data.line.line.end.x + dx, y: data.line.line.end.y + dy },
                },
                color: data.line.color,
                rotation: data.line.rotation,
                layer: data.line.layer,
              },
            };
          } else if (data.__kind__ === 'circle') {
            newData = {
              __kind__: 'circle',
              circle: {
                circle: {
                  center: { x: data.circle.circle.center.x + dx, y: data.circle.circle.center.y + dy },
                  radius: data.circle.circle.radius,
                },
                color: data.circle.color,
                rotation: data.circle.rotation,
                layer: data.circle.layer,
                fill: data.circle.fill,
              },
            };
          } else if (data.__kind__ === 'ellipse') {
            newData = {
              __kind__: 'ellipse',
              ellipse: {
                ellipse: {
                  center: { x: data.ellipse.ellipse.center.x + dx, y: data.ellipse.ellipse.center.y + dy },
                  radiusX: data.ellipse.ellipse.radiusX,
                  radiusY: data.ellipse.ellipse.radiusY,
                },
                color: data.ellipse.color,
                rotation: data.ellipse.rotation,
                layer: data.ellipse.layer,
                fill: data.ellipse.fill,
              },
            };
          } else if (data.__kind__ === 'rectangle') {
            newData = {
              __kind__: 'rectangle',
              rectangle: {
                rectangle: {
                  topLeft: { x: data.rectangle.rectangle.topLeft.x + dx, y: data.rectangle.rectangle.topLeft.y + dy },
                  width: data.rectangle.rectangle.width,
                  height: data.rectangle.rectangle.height,
                },
                color: data.rectangle.color,
                rotation: data.rectangle.rotation,
                layer: data.rectangle.layer,
                fill: data.rectangle.fill,
              },
            };
          } else if (data.__kind__ === 'octagon') {
            newData = {
              __kind__: 'octagon',
              octagon: {
                octagon: {
                  center: { x: data.octagon.octagon.center.x + dx, y: data.octagon.octagon.center.y + dy },
                  size: data.octagon.octagon.size,
                },
                color: data.octagon.color,
                rotation: data.octagon.rotation,
                layer: data.octagon.layer,
                fill: data.octagon.fill,
              },
            };
          } else if (data.__kind__ === 'polyline') {
            newData = {
              __kind__: 'polyline',
              polyline: {
                polyline: {
                  points: data.polyline.polyline.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
                },
                color: data.polyline.color,
                rotation: data.polyline.rotation,
                layer: data.polyline.layer,
              },
            };
          } else if (data.__kind__ === 'arc') {
            newData = {
              __kind__: 'arc',
              arc: {
                arc: {
                  center: { x: data.arc.arc.center.x + dx, y: data.arc.arc.center.y + dy },
                  radius: data.arc.arc.radius,
                  startAngle: data.arc.arc.startAngle,
                  endAngle: data.arc.arc.endAngle,
                },
                color: data.arc.color,
                rotation: data.arc.rotation,
                layer: data.arc.layer,
              },
            };
          } else {
            newData = data;
          }

          return { ...obj, data: newData };
        });

        addToHistory(updatedObjects);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectIds, objects, tool, pan]);

  // Setup event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('dblclick', handleDoubleClick);

    // Update cursor based on tool
    if (tool === 'pan') {
      canvas.style.cursor = 'grab';
    } else if (tool === 'explode') {
      canvas.style.cursor = 'pointer';
    } else {
      canvas.style.cursor = 'crosshair';
    }

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('dblclick', handleDoubleClick);
    };
  }, [tool, objects, selectedObjectIds, zoom, pan, layers, activeLayerId, snapEnabled]);

  useEffect(() => {
    renderCanvas();
  }, [objects, selectedObjectIds, zoom, pan, layers, unit, convertFromPixels, getUnitLabel]);

  return {
    tool,
    setTool,
    objects: objects.map((o) => o.data),
    selectedObjectIds,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
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
  };
}
