import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Float "mo:core/Float";
import Array "mo:core/Array";
import Migration "migration";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";

(with migration = Migration.run)
actor {
  include MixinObjectStorage();

  let projects = Map.empty<Text, Project>();

  public type Point = {
    x : Float;
    y : Float;
  };

  public type Line = {
    start : Point;
    end : Point;
  };

  public type Circle = {
    center : Point;
    radius : Float;
  };

  public type Ellipse = {
    center : Point;
    radiusX : Float;
    radiusY : Float;
  };

  public type Rectangle = {
    topLeft : Point;
    width : Float;
    height : Float;
  };

  public type Octagon = {
    center : Point;
    size : Float;
  };

  public type Polyline = {
    points : [Point];
  };

  public type Arc = {
    center : Point;
    radius : Float;
    startAngle : Float;
    endAngle : Float;
  };

  public type Color = {
    #red;
    #blue;
    #yellow;
    #green;
    #white;
    #none;
  };

  public type DrawingObject = {
    #line : {
      line : Line;
      color : Color;
      rotation : Float;
      layer : Nat;
    };
    #circle : {
      circle : Circle;
      color : Color;
      rotation : Float;
      layer : Nat;
      fill : Color;
    };
    #ellipse : {
      ellipse : Ellipse;
      color : Color;
      rotation : Float;
      layer : Nat;
      fill : Color;
    };
    #rectangle : {
      rectangle : Rectangle;
      color : Color;
      rotation : Float;
      layer : Nat;
      fill : Color;
    };
    #octagon : {
      octagon : Octagon;
      color : Color;
      rotation : Float;
      layer : Nat;
      fill : Color;
    };
    #polyline : {
      polyline : Polyline;
      color : Color;
      rotation : Float;
      layer : Nat;
    };
    #arc : {
      arc : Arc;
      color : Color;
      rotation : Float;
      layer : Nat;
    };
    #filledRectangle : {
      rectangle : Rectangle;
      color : Color;
      rotation : Float;
      layer : Nat;
      fill : Color;
    };
    #filledCircle : {
      circle : Circle;
      color : Color;
      rotation : Float;
      layer : Nat;
      fill : Color;
    };
  };

  public type Layer = {
    id : Nat;
    name : Text;
    color : Color;
    visible : Bool;
  };

  public type UnitSystem = {
    #inches;
    #centimeters;
    #pixels;
  };

  // Internal project type using mo:core Map (not shareable across candid)
  type Project = {
    id : Text;
    name : Text;
    objects : [DrawingObject];
    layers : Map.Map<Nat, Layer>;
    activeLayer : Nat;
    unitSystem : UnitSystem;
    created : Time.Time;
    modified : Time.Time;
  };

  // Public project type for candid API (layers as array of tuples)
  public type ProjectPublic = {
    id : Text;
    name : Text;
    objects : [DrawingObject];
    layers : [(Nat, Layer)];
    activeLayer : Nat;
    unitSystem : UnitSystem;
    created : Time.Time;
    modified : Time.Time;
  };

  func projectToPublic(p : Project) : ProjectPublic {
    {
      id = p.id;
      name = p.name;
      objects = p.objects;
      layers = p.layers.toArray();
      activeLayer = p.activeLayer;
      unitSystem = p.unitSystem;
      created = p.created;
      modified = p.modified;
    };
  };

  func layersFromArray(arr : [(Nat, Layer)]) : Map.Map<Nat, Layer> {
    let m = Map.empty<Nat, Layer>();
    for ((k, v) in arr.values()) {
      m.add(k, v);
    };
    m;
  };

  public func saveProject(id : Text, name : Text, objects : [DrawingObject], layers : [(Nat, Layer)], activeLayer : Nat, unitSystem : UnitSystem) : async () {
    let now = Time.now();
    let project : Project = {
      id;
      name;
      objects;
      layers = layersFromArray(layers);
      activeLayer;
      unitSystem;
      created = now;
      modified = now;
    };
    projects.add(id, project);
  };

  public query func loadProject(id : Text) : async ?ProjectPublic {
    switch (projects.get(id)) {
      case (null) { null };
      case (?p) { ?projectToPublic(p) };
    };
  };

  public query func listProjects() : async [ProjectPublic] {
    projects.values().map<Project, ProjectPublic>(func p = projectToPublic(p)).toArray();
  };

  public func deleteProject(id : Text) : async () {
    projects.remove(id);
  };

  public func clearAllProjects() : async () {
    projects.clear();
  };

  public query func getProjectCount() : async Nat {
    projects.size();
  };

  public func updateProject(id : Text, objects : [DrawingObject], layers : [(Nat, Layer)], activeLayer : Nat, unitSystem : UnitSystem) : async Bool {
    switch (projects.get(id)) {
      case (null) { false };
      case (?existing) {
        let updated : Project = {
          id = existing.id;
          name = existing.name;
          objects;
          layers = layersFromArray(layers);
          activeLayer;
          unitSystem;
          created = existing.created;
          modified = Time.now();
        };
        projects.add(id, updated);
        true;
      };
    };
  };

  public query func getProjectMetadata(id : Text) : async ?{
    name : Text;
    created : Time.Time;
    modified : Time.Time;
    unitSystem : UnitSystem;
  } {
    switch (projects.get(id)) {
      case (null) { null };
      case (?project) {
        ?{
          name = project.name;
          created = project.created;
          modified = project.modified;
          unitSystem = project.unitSystem;
        };
      };
    };
  };

  public query func getAllProjectIds() : async [Text] {
    projects.keys().toArray();
  };

  public func duplicateProject(id : Text, newId : Text, newName : Text) : async Bool {
    switch (projects.get(id)) {
      case (null) { false };
      case (?existing) {
        let now = Time.now();
        let duplicate : Project = {
          id = newId;
          name = newName;
          objects = existing.objects;
          layers = existing.layers.clone();
          activeLayer = existing.activeLayer;
          unitSystem = existing.unitSystem;
          created = now;
          modified = now;
        };
        projects.add(newId, duplicate);
        true;
      };
    };
  };

  public query func getProjectByName(name : Text) : async ?ProjectPublic {
    switch (projects.values().find(func(p : Project) : Bool { p.name == name })) {
      case (null) { null };
      case (?p) { ?projectToPublic(p) };
    };
  };

  public query func searchProjectsByName(searchTerm : Text) : async [ProjectPublic] {
    let results = List.empty<ProjectPublic>();
    for (project in projects.values()) {
      if (project.name.contains(#text searchTerm)) {
        results.add(projectToPublic(project));
      };
    };
    results.toArray();
  };

  public func addLayer(projectId : Text, layerId : Nat, name : Text, color : Color) : async Bool {
    switch (projects.get(projectId)) {
      case (null) { false };
      case (?project) {
        let newLayer : Layer = {
          id = layerId;
          name;
          color;
          visible = true;
        };
        project.layers.add(layerId, newLayer);
        let updatedProject : Project = {
          project with
          modified = Time.now();
        };
        projects.add(projectId, updatedProject);
        true;
      };
    };
  };

  public func setLayerVisibility(projectId : Text, layerId : Nat, visible : Bool) : async Bool {
    switch (projects.get(projectId)) {
      case (null) { false };
      case (?project) {
        switch (project.layers.get(layerId)) {
          case (null) { false };
          case (?layer) {
            let updatedLayer : Layer = {
              layer with
              visible;
            };
            project.layers.add(layerId, updatedLayer);
            let updatedProject : Project = {
              project with
              modified = Time.now();
            };
            projects.add(projectId, updatedProject);
            true;
          };
        };
      };
    };
  };

  public func setActiveLayer(projectId : Text, layerId : Nat) : async Bool {
    switch (projects.get(projectId)) {
      case (null) { false };
      case (?project) {
        let updatedProject : Project = {
          project with
          activeLayer = layerId;
          modified = Time.now();
        };
        projects.add(projectId, updatedProject);
        true;
      };
    };
  };

  public func setUnitSystem(projectId : Text, unitSystem : UnitSystem) : async Bool {
    switch (projects.get(projectId)) {
      case (null) { false };
      case (?project) {
        let updatedProject : Project = {
          project with
          unitSystem;
          modified = Time.now();
        };
        projects.add(projectId, updatedProject);
        true;
      };
    };
  };

  public query func getLayers(projectId : Text) : async ?[Layer] {
    switch (projects.get(projectId)) {
      case (null) { null };
      case (?project) {
        ?project.layers.values().toArray();
      };
    };
  };

  public func rotateObject(projectId : Text, objectIndex : Nat, rotation : Float) : async Bool {
    switch (projects.get(projectId)) {
      case (null) { false };
      case (?project) {
        if (objectIndex >= project.objects.size()) {
          return false;
        };
        let updatedObjects = Array.tabulate(
          project.objects.size(),
          func(i) {
            if (i == objectIndex) {
              switch (project.objects[i]) {
                case (#line obj) {
                  #line({ obj with rotation });
                };
                case (#circle obj) {
                  #circle({ obj with rotation });
                };
                case (#ellipse obj) {
                  #ellipse({ obj with rotation });
                };
                case (#rectangle obj) {
                  #rectangle({ obj with rotation });
                };
                case (#octagon obj) {
                  #octagon({ obj with rotation });
                };
                case (#polyline obj) {
                  #polyline({ obj with rotation });
                };
                case (#arc obj) {
                  #arc({ obj with rotation });
                };
                case (#filledRectangle obj) {
                  #filledRectangle({ obj with rotation });
                };
                case (#filledCircle obj) {
                  #filledCircle({ obj with rotation });
                };
              };
            } else {
              project.objects[i];
            };
          },
        );
        let updatedProject : Project = {
          project with
          objects = updatedObjects;
          modified = Time.now();
        };
        projects.add(projectId, updatedProject);
        true;
      };
    };
  };

  public func editLine(projectId : Text, objectIndex : Nat, newLine : Line) : async Bool {
    switch (projects.get(projectId)) {
      case (null) { false };
      case (?project) {
        if (objectIndex >= project.objects.size()) {
          return false;
        };
        let updatedObjects = Array.tabulate(
          project.objects.size(),
          func(i) {
            if (i == objectIndex) {
              switch (project.objects[i]) {
                case (#line obj) {
                  #line({ obj with line = newLine });
                };
                case (#rectangle obj) {
                  #rectangle({
                    obj with
                    rectangle = {
                      obj.rectangle with
                      topLeft = newLine.start;
                      width = Float.abs(newLine.end.x - newLine.start.x);
                      height = Float.abs(newLine.end.y - newLine.start.y);
                    };
                  });
                };
                case (#octagon obj) {
                  #octagon({
                    obj with
                    octagon = {
                      obj.octagon with
                      center = newLine.start;
                      size = Float.abs(newLine.end.x - newLine.start.x);
                    };
                  });
                };
                case (#polyline obj) {
                  #polyline({
                    obj with
                    polyline = {
                      obj.polyline with
                      points = [newLine.start, newLine.end];
                    };
                  });
                };
                case (#arc obj) {
                  #arc({
                    obj with
                    arc = {
                      obj.arc with
                      center = newLine.start;
                      radius = Float.abs(newLine.end.x - newLine.start.x);
                    };
                  });
                };
                case (#filledRectangle obj) {
                  #filledRectangle({
                    obj with
                    rectangle = {
                      obj.rectangle with
                      topLeft = newLine.start;
                      width = Float.abs(newLine.end.x - newLine.start.x);
                      height = Float.abs(newLine.end.y - newLine.start.y);
                    };
                  });
                };
                case (#filledCircle obj) {
                  #filledCircle({
                    obj with
                    circle = {
                      obj.circle with
                      center = newLine.start;
                      radius = Float.abs(newLine.end.x - newLine.start.x);
                    };
                  });
                };
                case (other) { other };
              };
            } else {
              project.objects[i];
            };
          },
        );
        let updatedProject : Project = {
          project with
          objects = updatedObjects;
          modified = Time.now();
        };
        projects.add(projectId, updatedProject);
        true;
      };
    };
  };

  public func setFillColor(projectId : Text, objectIndex : Nat, fillColor : Color) : async Bool {
    switch (projects.get(projectId)) {
      case (null) { false };
      case (?project) {
        if (objectIndex >= project.objects.size()) {
          return false;
        };
        let updatedObjects = Array.tabulate(
          project.objects.size(),
          func(i) {
            if (i == objectIndex) {
              switch (project.objects[i]) {
                case (#circle obj) {
                  #circle({ obj with fill = fillColor });
                };
                case (#ellipse obj) {
                  #ellipse({ obj with fill = fillColor });
                };
                case (#rectangle obj) {
                  #rectangle({ obj with fill = fillColor });
                };
                case (#octagon obj) {
                  #octagon({ obj with fill = fillColor });
                };
                case (#filledRectangle obj) {
                  #filledRectangle({ obj with fill = fillColor });
                };
                case (#filledCircle obj) {
                  #filledCircle({ obj with fill = fillColor });
                };
                case (other) { other };
              };
            } else {
              project.objects[i];
            };
          },
        );
        let updatedProject : Project = {
          project with
          objects = updatedObjects;
          modified = Time.now();
        };
        projects.add(projectId, updatedProject);
        true;
      };
    };
  };

  public func snapToIntersection(projectId : Text, point : Point) : async ?Point {
    switch (projects.get(projectId)) {
      case (null) { null };
      case (?project) {
        var closestIntersection : ?Point = null;
        var minDistance : Float = 10.0;

        for (obj1 in project.objects.values()) {
          for (obj2 in project.objects.values()) {
            if (obj1 != obj2) {
              switch (obj1) {
                case (#line { line = line1 }) {
                  switch (obj2) {
                    case (#line { line = line2 }) {
                      let intersection = findIntersection(line1, line2);
                      switch (intersection) {
                        case (?p) {
                          let dist = distance(point, p);
                          if (dist < minDistance) {
                            closestIntersection := ?p;
                            minDistance := dist;
                          };
                        };
                        case (null) {};
                      };
                    };
                    case (#rectangle { rectangle }) {
                      let rectLines = rectangleToLines(rectangle);
                      for (rectLine in rectLines.values()) {
                        let intersection = findIntersection(line1, rectLine);
                        switch (intersection) {
                          case (?p) {
                            let dist = distance(point, p);
                            if (dist < minDistance) {
                              closestIntersection := ?p;
                              minDistance := dist;
                            };
                          };
                          case (null) {};
                        };
                      };
                    };
                    case (#octagon { octagon }) {
                      let octLines = octagonToLines(octagon);
                      for (octLine in octLines.values()) {
                        let intersection = findIntersection(line1, octLine);
                        switch (intersection) {
                          case (?p) {
                            let dist = distance(point, p);
                            if (dist < minDistance) {
                              closestIntersection := ?p;
                              minDistance := dist;
                            };
                          };
                          case (null) {};
                        };
                      };
                    };
                    case (_) {};
                  };
                };
                case (_) {};
              };
            };
          };
        };
        closestIntersection;
      };
    };
  };

  func findIntersection(line1 : Line, line2 : Line) : ?Point {
    let x1 = line1.start.x;
    let y1 = line1.start.y;
    let x2 = line1.end.x;
    let y2 = line1.end.y;

    let x3 = line2.start.x;
    let y3 = line2.start.y;
    let x4 = line2.end.x;
    let y4 = line2.end.y;

    let denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (denom == 0.0) {
      return null;
    };

    let px = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
    let py = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;

    if (isBetween(px, x1, x2) and isBetween(py, y1, y2) and isBetween(px, x3, x4) and isBetween(py, y3, y4)) {
      ?{ x = px; y = py };
    } else {
      null;
    };
  };

  func isBetween(val : Float, a : Float, b : Float) : Bool {
    (val >= Float.min(a, b)) and (val <= Float.max(a, b));
  };

  func distance(p1 : Point, p2 : Point) : Float {
    let dx = p1.x - p2.x;
    let dy = p1.y - p2.y;
    Float.sqrt(dx * dx + dy * dy);
  };

  func rectangleToLines(rect : Rectangle) : [Line] {
    let topLeft = rect.topLeft;
    let topRight = { x = topLeft.x + rect.width; y = topLeft.y };
    let bottomLeft = { x = topLeft.x; y = topLeft.y + rect.height };
    let bottomRight = { x = topLeft.x + rect.width; y = topLeft.y + rect.height };

    [
      { start = topLeft; end = topRight },
      { start = topRight; end = bottomRight },
      { start = bottomRight; end = bottomLeft },
      { start = bottomLeft; end = topLeft },
    ];
  };

  func octagonToLines(oct : Octagon) : [Line] {
    let center = oct.center;
    let size = oct.size;
    let angleStep = 3.141592653589793 / 4.0;
    let points = List.empty<Point>();

    var i = 0;
    while (i < 8) {
      let angle = i.toFloat() * angleStep;
      let x = center.x + size * Float.cos(angle);
      let y = center.y + size * Float.sin(angle);
      points.add({ x; y });
      i += 1;
    };

    let pointsArray = points.toArray();
    let lines = List.empty<Line>();
    i := 0;
    while (i < 8) {
      let start = pointsArray[i];
      let end_ = pointsArray[(i + 1) % 8];
      lines.add({ start; end = end_ });
      i += 1;
    };
    lines.toArray();
  };

  public func convertToFilledShape(projectId : Text, objectIndex : Nat) : async Bool {
    switch (projects.get(projectId)) {
      case (null) { false };
      case (?project) {
        if (objectIndex >= project.objects.size()) {
          return false;
        };

        let updatedObjects = Array.tabulate(
          project.objects.size(),
          func(i) {
            if (i == objectIndex) {
              switch (project.objects[i]) {
                case (#rectangle obj) {
                  #filledRectangle({
                    rectangle = obj.rectangle;
                    color = obj.color;
                    rotation = obj.rotation;
                    layer = obj.layer;
                    fill = #green;
                  });
                };
                case (#circle obj) {
                  #filledCircle({
                    circle = obj.circle;
                    color = obj.color;
                    rotation = obj.rotation;
                    layer = obj.layer;
                    fill = #green;
                  });
                };
                case (other) { other };
              };
            } else {
              project.objects[i];
            };
          },
        );

        let updatedProject : Project = {
          project with
          objects = updatedObjects;
          modified = Time.now();
        };
        projects.add(projectId, updatedProject);
        true;
      };
    };
  };

  public func createRectangle(topLeft : Point, width : Float, height : Float, color : Color, rotation : Float, layer : Nat) : async DrawingObject {
    #rectangle({
      rectangle = {
        topLeft;
        width;
        height;
      };
      color;
      rotation;
      layer;
      fill = #green;
    });
  };

  public func createCircle(center : Point, radius : Float, color : Color, rotation : Float, layer : Nat) : async DrawingObject {
    #circle({
      circle = {
        center;
        radius;
      };
      color;
      rotation;
      layer;
      fill = #green;
    });
  };
};
