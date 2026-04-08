import BaseToCore "BaseToCore";
import OrderedMap "mo:base/OrderedMap";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

module {
  // Duplicate types from main.mo (cannot import main.mo)
  type Point = { x : Float; y : Float };
  type Line = { start : Point; end : Point };
  type Circle = { center : Point; radius : Float };
  type Ellipse = { center : Point; radiusX : Float; radiusY : Float };
  type Rectangle = { topLeft : Point; width : Float; height : Float };
  type Octagon = { center : Point; size : Float };
  type Polyline = { points : [Point] };
  type Arc = { center : Point; radius : Float; startAngle : Float; endAngle : Float };
  type Color = { #red; #blue; #yellow; #green; #white; #none };
  type DrawingObject = {
    #line : { line : Line; color : Color; rotation : Float; layer : Nat };
    #circle : { circle : Circle; color : Color; rotation : Float; layer : Nat; fill : Color };
    #ellipse : { ellipse : Ellipse; color : Color; rotation : Float; layer : Nat; fill : Color };
    #rectangle : { rectangle : Rectangle; color : Color; rotation : Float; layer : Nat; fill : Color };
    #octagon : { octagon : Octagon; color : Color; rotation : Float; layer : Nat; fill : Color };
    #polyline : { polyline : Polyline; color : Color; rotation : Float; layer : Nat };
    #arc : { arc : Arc; color : Color; rotation : Float; layer : Nat };
    #filledRectangle : { rectangle : Rectangle; color : Color; rotation : Float; layer : Nat; fill : Color };
    #filledCircle : { circle : Circle; color : Color; rotation : Float; layer : Nat; fill : Color };
  };
  type Layer = { id : Nat; name : Text; color : Color; visible : Bool };
  type UnitSystem = { #inches; #centimeters; #pixels };

  // Type matching old Storage.State from mo:caffeineai-object-storage/Storage
  // The old version had an extra `blobTodeletete` field (note the typo in original)
  type StorageState = {
    var authorizedPrincipals : [Principal];
    var blobTodeletete : [Blob];
  };

  type OldProject = {
    id : Text;
    name : Text;
    objects : [DrawingObject];
    layers : OrderedMap.Map<Nat, Layer>;
    activeLayer : Nat;
    unitSystem : UnitSystem;
    created : Int;
    modified : Int;
  };

  type NewProject = {
    id : Text;
    name : Text;
    objects : [DrawingObject];
    layers : Map.Map<Nat, Layer>;
    activeLayer : Nat;
    unitSystem : UnitSystem;
    created : Int;
    modified : Int;
  };

  type OldActor = {
    storage : StorageState;
    var projects : OrderedMap.Map<Text, OldProject>;
  };

  type NewActor = {
    projects : Map.Map<Text, NewProject>;
  };

  func migrateProject(old : OldProject) : NewProject {
    {
      old with
      layers = BaseToCore.migrateOrderedMap<Nat, Layer>(old.layers);
    };
  };

  public func run(old : OldActor) : NewActor {
    {
      projects = BaseToCore.migrateOrderedMap<Text, OldProject>(old.projects).map<Text, OldProject, NewProject>(
        func(_key, proj) { migrateProject(proj) }
      );
    };
  };
};
