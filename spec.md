# 2D CAD Web Application

## Overview
A basic 2D CAD web application that allows users to create, edit, and save technical drawings on a canvas interface with layer management capabilities, unit selection, and file import/export functionality.

## Core Features

### Drawing Tools
- **Line Tool**: Create straight lines by clicking two points on the canvas
- **Circle Tool**: Draw filled circles by clicking center point and dragging to set radius, filled with green color by default
- **Ellipse Tool**: Draw ellipses by clicking center point and dragging to set width and height
- **Rectangle Tool**: Create filled rectangles by clicking and dragging from corner to corner, filled with green color by default
- **Octagon Tool**: Draw regular octagons by clicking center point and dragging to set size
- **Polyline Tool**: Draw connected line segments by clicking multiple points, double-click to finish
- **Filled Rectangle Tool**: Create filled rectangles by clicking and dragging from corner to corner, filled with green color by default
- **Filled Circle Tool**: Draw filled circles by clicking center point and dragging to set radius, filled with green color by default

All drawing tools create shapes in white color by default for visibility on the black canvas background, except for the Rectangle, Circle, Filled Rectangle and Filled Circle tools which create filled shapes with green fill color by default.

### Editing Tools
- **Select Tool**: Click on objects to select them (visual selection indicator)
  - **Rectangle Selection**: Draw a rectangle to select all objects within the selection area
- **Move Tool**: Drag selected objects to new positions
  - **Keyboard Movement**: Use arrow keys to move selected objects in small increments
- **Copy Tool**: Duplicate selected objects and place copies
- **Multi-Copy Tool**: Create multiple copies of selected objects in a pattern or array
- **Mirror Tool**: Create mirrored copies of selected objects horizontally or vertically
- **Rotate Tool**: Rotate selected objects around their center point
- **Scale Tool**: Resize selected objects proportionally
- **Arc Edit Tool**: Convert straight edges from rectangles, octagons, or standalone lines into arcs by selecting existing line segments (including individual sides of rectangles and octagons) and converting them to arcs with draggable control points or editable arc parameters
- **Explode Tool**: Split overlapping objects at their intersection points, creating new individual segments at each intersection. Works with all supported shapes (lines, rectangles, circles, ellipses, octagons, polylines) and their intersections. When circles intersect with other shapes (rectangles, lines, other circles), both the circle and the intersecting shape are split at their intersection points. Circles are split into separate arc segments that can be individually selected and deleted. After exploding, users can manually select and delete individual resulting segments including arc segments from split circles.
- **Delete Objects**: Remove selected objects using the Delete key on the keyboard

### Navigation Tools
- **Pan Tool**: Move the drawing area view by mouse dragging or keyboard shortcuts (arrow keys, WASD keys)

### Measurement Tools
- **Measure Tool**: Measure distances and angles between points or objects on the canvas
  - **Distance Measurement**: Click two points to measure the distance between them
  - **Angle Measurement**: Click three points to measure the angle formed
  - **Measurement Display**: Show measurement values as temporary overlays on the canvas in the currently selected unit (Inches, CM, or Pixels). All measurement calculations are performed in the selected unit system and displayed values are properly converted and formatted according to the chosen unit. When the unit system is changed, all existing measurement overlays and new measurements automatically update to display in the new unit system.

### Units System
- **Units Tool**: Top menu dropdown allowing users to select working units
  - **Unit Options**: Inches, Centimeters (CM), and Pixels
  - **Unit Conversion**: Automatically convert all measurements, rulers, grid spacing, property field values, measurement displays, and on-canvas dimension labels when switching units
  - **Display Updates**: All measurement displays, property panels, rulers, measurement overlays, and on-canvas dimension labels update to show values in the selected unit
  - **Default Unit**: Application starts with Pixels as the default unit

### Object Snapping
- **Snap Points**: Automatic snapping to key points when drawing or editing objects
  - **Corner Snap**: Snap to corners of rectangles, octagons and other shapes
  - **Endpoint Snap**: Snap to endpoints of lines and polylines
  - **Center Snap**: Snap to center points of objects
  - **Circle Center Snap**: Snap to center points of circles and ellipses
  - **Edge Midpoint Snap**: Snap to the center point of each side (edge) of rectangles and octagons
  - **Intersection Snap**: Snap reliably to intersection points where any two lines cross, including intersections between standalone lines, rectangle edges, octagon edges, and any combination thereof
  - **Circle Intersection Snap**: Snap to intersection points between two circles, between a line and a circle, and between a rectangle and a circle
- **Visual Snap Indicators**: Display visual feedback when snap points are detected
- **Snap Toggle**: Enable/disable snapping functionality

### Object Properties
- **Properties Panel**: Display panel (right or left side) showing editable properties when objects are selected with real-time updates
- **Position Controls**: Edit X and Y coordinates of selected objects with immediate canvas updates as the user types or changes values (displayed in selected unit)
- **Size Controls**: Modify dimensions/size of selected objects with immediate canvas updates as the user types or changes values (width, height, radius, etc. in selected unit). For filled rectangles and circles created with the Rectangle and Circle tools, size editing must work correctly with real-time canvas updates.
- **Rotation Control**: Adjust rotation angle of selected objects with immediate real-time canvas updates as the user changes the rotation value
- **Color Selection**: Choose object color from predefined options: RED, BLUE, YELLOW, GREEN, WHITE (default) with immediate canvas updates
- **Fill Color Selection**: For closed shapes (rectangles, circles, ellipses, octagons), when selected, a fully interactive and functional "Fill" color dropdown appears in the properties panel. The dropdown must be completely clickable and responsive, allowing users to click on it to open the dropdown menu and select from the predefined color palette: RED, BLUE, YELLOW, GREEN, WHITE, NONE (default). When a user clicks on any fill color option in the dropdown, the shape's interior is immediately filled with the chosen color and the canvas is updated in real-time to visually reflect the new fill color. The selected fill color persists when switching between objects, after editing operations, and when saving/loading projects. The fill color is properly rendered on the canvas for all supported closed shapes with correct visual representation and immediate visual feedback upon selection. Shapes created with the Rectangle and Circle tools start with green fill color by default, which can be changed through this dropdown.
- **Arc Properties**: Edit arc parameters including radius, start angle, and end angle for converted edges and exploded circle segments with immediate canvas updates
- **Real-time Property Updates**: All property changes in the panel immediately reflect on the canvas for all supported object types, including position and size input field changes. This must work correctly for filled rectangles and circles created with the Rectangle and Circle tools.
- **Unit Display**: All property values display in the currently selected unit with automatic conversion when unit system changes

### Layer Management
- **Layer Panel**: Interface to manage drawing layers
- **Create Layer**: Add new layers with custom names and colors
- **Layer Visibility**: Toggle layer visibility on/off
- **Layer Assignment**: Assign drawing objects to specific layers
- **Active Layer**: Set which layer new objects are drawn on
- **Layer Colors**: Each layer can have a custom color that overrides object colors

### File Import/Export
- **DXF Import**: Load DXF files into the canvas, converting supported geometry to native drawing objects
- **DXF Export**: Save current drawing as DXF file format with all objects and layers
- **SVG Import**: Load SVG files into the canvas, converting supported vector graphics to native drawing objects
- **SVG Export**: Save current drawing as SVG file format preserving vector graphics
- **PDF Export**: Export current drawing as PDF file (if technically feasible)
- **File Format Support**: Prioritize full DXF and SVG import/export functionality

### User Interface
- **Tool Palette**: Left-side tool palette displaying tools in a 2-column layout for better organization and accessibility. Tools include Select, Pan, Line, Rectangle, Circle, Ellipse, Octagon, Polyline, Filled Rectangle, Filled Circle, Arc Edit, Move, Copy, Multi-Copy, Mirror, Rotate, Scale, Explode, and Measure tools arranged in two columns for easier access. Each tool has a distinct visual appearance and behavior that clearly differentiates it from other tools.
- **Responsive Layout**: Tool palette maintains 2-column layout and usability across various screen sizes
- Top menu with Units dropdown selector for switching between Inches, CM, and Pixels
- Expanded canvas area with significantly larger workspace for drawing operations
- Layer management panel for organizing drawing elements
- Properties panel for editing selected object attributes with real-time canvas updates including position, size, rotation, and a fully interactive and functional fill color dropdown for closed shapes that is completely clickable, opens properly when clicked, allows users to select fill colors from the dropdown menu, and immediately applies the selected fill color to shape interiors with instant visual feedback and persistence (values shown in selected unit with automatic conversion). The Properties panel must work correctly for filled rectangles and circles created with the Rectangle and Circle tools, allowing real-time editing of their size and position.
- Save and Load buttons for project management
- Import and Export buttons for DXF, SVG, and PDF file operations
- Clear canvas functionality
- Snap toggle control for enabling/disabling object snapping
- Application content displayed in English

### Canvas Interaction
- Mouse-based input for all drawing, editing, navigation, and measurement operations
- Keyboard input for arrow key movement of selected objects and canvas panning
- Delete key functionality for removing selected objects
- Visual feedback during tool usage (preview lines, selection highlights, rectangle selection, snap indicators)
- Zoom and pan capabilities for canvas navigation
- Snap point detection and visual indicators during drawing operations with reliable intersection detection including circle-to-circle, line-to-circle, and rectangle-to-circle intersections
- Rulers and grid display that update based on selected unit system
- Fill functionality for closed shapes through the Properties panel with a fully interactive and functional fill color dropdown that opens when clicked, allows users to select fill colors from the dropdown options, and immediately applies the selected fill color to shape interiors with proper rendering on the canvas and persistence across operations. The Rectangle and Circle tools must correctly create filled shapes (not just outlines) with green fill color by default.

## Backend Requirements
The backend must store drawing project data including:
- Drawing objects with their geometric properties (coordinates, dimensions, type, color, rotation, arc parameters, fill color with persistence including default green fill for shapes created with Rectangle and Circle tools)
- Exploded line segments and arc segments created from intersection operations
- Layer information (names, colors, visibility states, object assignments)
- Project metadata (creation date, last modified)
- User's saved projects list
- Selected unit system for each project
- Imported file data and metadata

Backend operations:
- Save drawing projects with layer data and object properties including arc modifications, rotation values, persistent fill colors including default green fill for filled shapes, and exploded segments including arc segments from split circles
- Load existing drawing projects with layer information and object attributes including persistent fill colors
- List user's saved projects
- Delete projects
- Store and retrieve unit system preferences per project
- Handle file upload operations for DXF and SVG import
- Generate and serve exported files (DXF, SVG, PDF) for download

## Technical Notes
This is a 2D game application where all active drawing state, canvas interactions, layer management, object property editing with real-time position and size updates (including for filled rectangles and circles created with the Rectangle and Circle tools), fully interactive and functional fill color management through the Properties panel dropdown with immediate visual feedback and persistence for shape interiors with proper canvas rendering including default green fill for Rectangle and Circle tools, enhanced snapping functionality with reliable intersection detection including circle-to-circle, line-to-circle, and rectangle-to-circle intersections, measurement operations with unit conversion, unit system management, and explode tool functionality with circle splitting capabilities are handled in the frontend. The Rectangle and Circle tools must correctly create filled shapes (not just outlines) with green fill color by default. Only completed projects with their layer configurations, object properties including persistent fill colors, unit settings, and exploded segments including arc segments are saved to the backend for persistence. File import/export operations involve frontend processing with backend file handling support.
