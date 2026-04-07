import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type DrawingObject = {
    __kind__: "arc";
    arc: {
        arc: Arc;
        rotation: number;
        color: Color;
        layer: bigint;
    };
} | {
    __kind__: "ellipse";
    ellipse: {
        rotation: number;
        ellipse: Ellipse;
        fill: Color;
        color: Color;
        layer: bigint;
    };
} | {
    __kind__: "filledRectangle";
    filledRectangle: {
        rotation: number;
        rectangle: Rectangle;
        fill: Color;
        color: Color;
        layer: bigint;
    };
} | {
    __kind__: "rectangle";
    rectangle: {
        rotation: number;
        rectangle: Rectangle;
        fill: Color;
        color: Color;
        layer: bigint;
    };
} | {
    __kind__: "polyline";
    polyline: {
        rotation: number;
        polyline: Polyline;
        color: Color;
        layer: bigint;
    };
} | {
    __kind__: "line";
    line: {
        rotation: number;
        line: Line;
        color: Color;
        layer: bigint;
    };
} | {
    __kind__: "circle";
    circle: {
        rotation: number;
        fill: Color;
        color: Color;
        circle: Circle;
        layer: bigint;
    };
} | {
    __kind__: "filledCircle";
    filledCircle: {
        rotation: number;
        fill: Color;
        color: Color;
        circle: Circle;
        layer: bigint;
    };
} | {
    __kind__: "octagon";
    octagon: {
        rotation: number;
        fill: Color;
        color: Color;
        layer: bigint;
        octagon: Octagon;
    };
};
export interface Circle {
    center: Point;
    radius: number;
}
export interface Arc {
    center: Point;
    endAngle: number;
    startAngle: number;
    radius: number;
}
export type Time = bigint;
export interface Point {
    x: number;
    y: number;
}
export interface Rectangle {
    height: number;
    width: number;
    topLeft: Point;
}
export interface Layer {
    id: bigint;
    name: string;
    color: Color;
    visible: boolean;
}
export type Tree = {
    __kind__: "red";
    red: [Tree, bigint, Layer, Tree];
} | {
    __kind__: "leaf";
    leaf: null;
} | {
    __kind__: "black";
    black: [Tree, bigint, Layer, Tree];
};
export interface Line {
    end: Point;
    start: Point;
}
export interface Polyline {
    points: Array<Point>;
}
export interface Octagon {
    center: Point;
    size: number;
}
export interface Project {
    id: string;
    created: Time;
    modified: Time;
    name: string;
    layers: Map_;
    objects: Array<DrawingObject>;
    activeLayer: bigint;
    unitSystem: UnitSystem;
}
export interface Map_ {
    root: Tree;
    size: bigint;
}
export interface Ellipse {
    center: Point;
    radiusX: number;
    radiusY: number;
}
export enum Color {
    red = "red",
    blue = "blue",
    none = "none",
    green = "green",
    white = "white",
    yellow = "yellow"
}
export enum UnitSystem {
    centimeters = "centimeters",
    pixels = "pixels",
    inches = "inches"
}
export interface backendInterface {
    addLayer(projectId: string, layerId: bigint, name: string, color: Color): Promise<boolean>;
    clearAllProjects(): Promise<void>;
    convertToFilledShape(projectId: string, objectIndex: bigint): Promise<boolean>;
    createCircle(center: Point, radius: number, color: Color, rotation: number, layer: bigint): Promise<DrawingObject>;
    createRectangle(topLeft: Point, width: number, height: number, color: Color, rotation: number, layer: bigint): Promise<DrawingObject>;
    deleteProject(id: string): Promise<void>;
    duplicateProject(id: string, newId: string, newName: string): Promise<boolean>;
    editLine(projectId: string, objectIndex: bigint, newLine: Line): Promise<boolean>;
    getAllProjectIds(): Promise<Array<string>>;
    getLayers(projectId: string): Promise<Array<Layer> | null>;
    getProjectByName(name: string): Promise<Project | null>;
    getProjectCount(): Promise<bigint>;
    getProjectMetadata(id: string): Promise<{
        created: Time;
        modified: Time;
        name: string;
        unitSystem: UnitSystem;
    } | null>;
    listProjects(): Promise<Array<Project>>;
    loadProject(id: string): Promise<Project | null>;
    rotateObject(projectId: string, objectIndex: bigint, rotation: number): Promise<boolean>;
    saveProject(id: string, name: string, objects: Array<DrawingObject>, layers: Map_, activeLayer: bigint, unitSystem: UnitSystem): Promise<void>;
    searchProjectsByName(searchTerm: string): Promise<Array<Project>>;
    setActiveLayer(projectId: string, layerId: bigint): Promise<boolean>;
    setFillColor(projectId: string, objectIndex: bigint, fillColor: Color): Promise<boolean>;
    setLayerVisibility(projectId: string, layerId: bigint, visible: boolean): Promise<boolean>;
    setUnitSystem(projectId: string, unitSystem: UnitSystem): Promise<boolean>;
    snapToIntersection(projectId: string, point: Point): Promise<Point | null>;
    updateProject(id: string, objects: Array<DrawingObject>, layers: Map_, activeLayer: bigint, unitSystem: UnitSystem): Promise<boolean>;
}