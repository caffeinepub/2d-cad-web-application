// Shared CAD type definitions used by useCADEngine and useImportExport

export interface Point {
  x: number;
  y: number;
}

// Color enum (matches backend Color type)
export enum Color {
  red = "red",
  blue = "blue",
  yellow = "yellow",
  green = "green",
  white = "white",
  none = "none",
}

// Shape data types
export interface LineShape {
  start: Point;
  end: Point;
}

export interface CircleShape {
  center: Point;
  radius: number;
}

export interface ArcShape {
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
}

export interface RectangleShape {
  topLeft: Point;
  width: number;
  height: number;
}

export interface EllipseShape {
  center: Point;
  radiusX: number;
  radiusY: number;
}

export interface OctagonShape {
  center: Point;
  size: number;
}

export interface PolylineShape {
  points: Point[];
}

// Drawing object variants — must match backend DrawingObject discriminated union exactly
export type DrawingObject =
  | {
      __kind__: "line";
      line: { line: LineShape; color: Color; rotation: number; layer: bigint };
    }
  | {
      __kind__: "circle";
      circle: {
        circle: CircleShape;
        color: Color;
        rotation: number;
        layer: bigint;
        fill: Color;
      };
    }
  | {
      __kind__: "arc";
      arc: { arc: ArcShape; color: Color; rotation: number; layer: bigint };
    }
  | {
      __kind__: "rectangle";
      rectangle: {
        rectangle: RectangleShape;
        color: Color;
        rotation: number;
        layer: bigint;
        fill: Color;
      };
    }
  | {
      __kind__: "filledRectangle";
      filledRectangle: {
        rectangle: RectangleShape;
        color: Color;
        rotation: number;
        layer: bigint;
        fill: Color;
      };
    }
  | {
      __kind__: "ellipse";
      ellipse: {
        ellipse: EllipseShape;
        color: Color;
        rotation: number;
        layer: bigint;
        fill: Color;
      };
    }
  | {
      __kind__: "octagon";
      octagon: {
        octagon: OctagonShape;
        color: Color;
        rotation: number;
        layer: bigint;
        fill: Color;
      };
    }
  | {
      __kind__: "polyline";
      polyline: {
        polyline: PolylineShape;
        color: Color;
        rotation: number;
        layer: bigint;
      };
    }
  | {
      __kind__: "filledCircle";
      filledCircle: {
        circle: CircleShape;
        color: Color;
        rotation: number;
        layer: bigint;
        fill: Color;
      };
    };

export interface Layer {
  id: bigint;
  name: string;
  color: string;
  visible: boolean;
}

export type UnitSystem = "pixels" | "inches" | "centimeters";
