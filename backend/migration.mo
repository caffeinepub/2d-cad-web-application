import OrderedMap "mo:base/OrderedMap";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Time "mo:base/Time";

module {
  type Point = {
    x : Float;
    y : Float;
  };

  type Line = {
    start : Point;
    end : Point;
  };

  type Circle = {
    center : Point;
    radius : Float;
  };

  type Ellipse = {
    center : Point;
    radiusX : Float;
    radiusY : Float;
  };

  type Rectangle = {
    topLeft : Point;
    width : Float;
    height : Float;
  };

  type Octagon = {
    center : Point;
    size : Float;
  };

  type Polyline = {
    points : [Point];
  };

  type Arc = {
    center : Point;
    radius : Float;
    startAngle : Float;
    endAngle : Float;
  };

  type Color = {
    #red;
    #blue;
    #yellow;
    #green;
    #white;
    #none;
  };

  type DrawingObject = {
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

  type Layer = {
    id : Nat;
    name : Text;
    color : Color;
    visible : Bool;
  };

  type UnitSystem = {
    #inches;
    #centimeters;
    #pixels;
  };

  type Project = {
    id : Text;
    name : Text;
    objects : [DrawingObject];
    layers : OrderedMap.Map<Nat, Layer>;
    activeLayer : Nat;
    unitSystem : UnitSystem;
    created : Time.Time;
    modified : Time.Time;
  };

  type OldActor = {
    projects : OrderedMap.Map<Text, Project>;
  };

  type NewActor = {
    projects : OrderedMap.Map<Text, Project>;
  };

  public func run(old : OldActor) : NewActor {
    let textMap = OrderedMap.Make<Text>(Text.compare);
    let projects = textMap.map<Project, Project>(
      old.projects,
      func(_id, project) {
        let updatedObjects = Array.map<DrawingObject, DrawingObject>(
          project.objects,
          func(obj) {
            switch (obj) {
              case (#rectangle rectObj) {
                #rectangle({
                  rectObj with
                  fill = #green;
                });
              };
              case (#circle circObj) {
                #circle({
                  circObj with
                  fill = #green;
                });
              };
              case (other) { other };
            };
          },
        );
        { project with objects = updatedObjects };
      },
    );
    { projects };
  };
};

