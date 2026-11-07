// FeatureScript Guide Test: Everything At Once — Onshape FeatureScript
// ====================================================================
// One file that runs every small example from the FeatureScript
// introduction guide in a single paste, so you can confirm the guide's
// code builds without pasting each chapter's example separately.
//
// WHAT IT CONTAINS
// - pt(), the sketch-point helper, defined once at the top and shared
//   by every feature below. The guide's listings each define it, because
//   each listing is standalone; here it lives once.
// - LumberSize / isLumber / Lumber / lumber() from the type-tags chapter.
// - myFeature, the defineFeature skeleton from the define-feature chapter.
// - parameterizedBlock, the complete block from the hello-feature chapter.
// - identityExperiment, the two-box UNION test from the test chapter.
// - guideTestAll, a new master feature that runs the snippet-level
//   examples (types, units, vectors, functions, control flow, errors,
//   ids, queries) as real code with verify() checks, builds geometry
//   with extrude, fillet, revolve, chamfer, boolean, loft and thicken,
//   and prints a line per section to the console.
//
// HOW TO RUN IT
// Paste the whole file into a Feature Studio. Four features appear in
// the custom-feature dropdown: My Feature, Parameterized Block,
// Identity Experiment, and Guide Test: Everything At Once. Add each one
// in a Part Studio; each should regenerate with no errors.
// - Guide Test is the thorough one: open the console and check every
//   line says "ok". It ends by printing GUIDE TEST: ALL CHECKS PASSED.
// - Two deliberate errors are part of the test: a try (0 / 0) and a
//   deliberate throw inside a try/catch. They WILL appear in the notices
//   flyout. That is the test working, not a failure: the feature still
//   regenerates, and the checks after them still run.
// - The identity experiment prints how many bodies qCreatedBy finds via
//   the boolean's own id. The docs say the merged body is findable that
//   way; if the count prints 0, the observed failure is the behaviour.
// - Guide Test ends with several solid bodies (merged block + tube, loft
//   box, thickened sampler slabs). That is expected: it is a test feature,
//   not a part.
//
// The battery holder itself is NOT in this file: it is the guide's
// appendix, 327 lines, and it gets its own test run.

FeatureScript 3112;
import(path : "onshape/std/common.fs", version : "3112.0");

// Builds a 2D sketch point from two lengths, using the documented idiom
// vector(number, number) * unit. Never pass lengths straight into vector().
function pt(x is ValueWithUnits, y is ValueWithUnits)
{
    return vector(x / millimeter, y / millimeter) * millimeter;
}

const zero = 0 * millimeter;   // a zero that is a length, for centers on an axis

// --- type-tags chapter: a custom type, its predicate, and its constructor ---
export enum LumberSize { TWO_BY_FOUR, TWO_BY_SIX, TWO_BY_EIGHT }

export type Lumber typecheck isLumber;
export predicate isLumber(value)
{
    value is map;
    value.size is LumberSize;
    isLength(value.length);
}

function lumber(size is LumberSize, length is ValueWithUnits)
{
    return { "size" : size, "length" : length } as Lumber;
}

// --- define-feature chapter: the skeleton ---
annotation { "Feature Type Name" : "My Feature" }
export const myFeature = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Depth" }
        isLength(definition.depth, { (millimeter) : [1, 10, 100] } as LengthBoundSpec);
    }
    {
        // build geometry here
    }, {});

// --- hello-feature chapter: the parameterized block ---
annotation { "Feature Type Name" : "Parameterized Block" }
export const parameterizedBlock = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Length" }
        isLength(definition.length, { (millimeter) : [1, 50, 500] } as LengthBoundSpec);
        annotation { "Name" : "Width" }
        isLength(definition.width, { (millimeter) : [1, 30, 500] } as LengthBoundSpec);
        annotation { "Name" : "Height" }
        isLength(definition.height, { (millimeter) : [1, 20, 500] } as LengthBoundSpec);
    }
    {
        var sketch = newSketchOnPlane(context, id + "sketch", {
                "sketchPlane" : plane(vector(0, 0, 0) * millimeter, vector(0, 0, 1))
            });
        skRectangle(sketch, "rect", {
                "firstCorner" : pt(-definition.length / 2, -definition.width / 2),
                "secondCorner" : pt(definition.length / 2, definition.width / 2)
            });
        skSolve(sketch);
        opExtrude(context, id + "block", {
                "entities" : qSketchRegion(id + "sketch"),
                "direction" : vector(0, 0, 1),
                "endBound" : BoundingType.BLIND,
                "endDepth" : definition.height
            });
    });

// --- test chapter: the identity experiment ---
annotation { "Feature Type Name" : "Identity Experiment" }
export const identityExperiment = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Box size" }
        isLength(definition.size, { (millimeter) : [5, 10, 50] } as LengthBoundSpec);
    }
    {
        const s = definition.size;
        var sk1 = newSketchOnPlane(context, id + "sk1", {
                "sketchPlane" : plane(vector(0, 0, 0) * millimeter, vector(0, 0, 1))
            });
        skRectangle(sk1, "r1", { "firstCorner" : pt(-s, -s), "secondCorner" : pt(s, s) });
        skSolve(sk1);
        opExtrude(context, id + "box1", {
                "entities" : qSketchRegion(id + "sk1"),
                "direction" : vector(0, 0, 1),
                "endBound" : BoundingType.BLIND,
                "endDepth" : s
            });
        var sk2 = newSketchOnPlane(context, id + "sk2", {
                "sketchPlane" : plane(vector(0, 0, 1) * (s / 2), vector(0, 0, 1))
            });
        skRectangle(sk2, "r2", { "firstCorner" : pt(0 * millimeter, -s), "secondCorner" : pt(2 * s, s) });
        skSolve(sk2);
        opExtrude(context, id + "box2", {
                "entities" : qSketchRegion(id + "sk2"),
                "direction" : vector(0, 0, 1),
                "endBound" : BoundingType.BLIND,
                "endDepth" : s
            });
        opBoolean(context, id + "merge", {
                "tools" : qUnion([qCreatedBy(id + "box1", EntityType.BODY), qCreatedBy(id + "box2", EntityType.BODY)]),
                "operationType" : BooleanOperationType.UNION
            });
        debug(context, qCreatedBy(id + "merge", EntityType.BODY));
    });

// --- the master test: every snippet-level example, as running code ---
annotation { "Feature Type Name" : "Guide Test: Everything At Once" }
export const guideTestAll = defineFeature(function(context is Context, id is Id, definition is map)
    precondition
    {
        annotation { "Name" : "Block length" }
        isLength(definition.length, { (millimeter) : [1, 50, 500] } as LengthBoundSpec);
        annotation { "Name" : "Block width" }
        isLength(definition.width, { (millimeter) : [1, 30, 500] } as LengthBoundSpec);
        annotation { "Name" : "Block height" }
        isLength(definition.height, { (millimeter) : [1, 20, 500] } as LengthBoundSpec);
        annotation { "Name" : "Fillet radius" }
        isLength(definition.filletRadius, { (millimeter) : [0.5, 1, 5] } as LengthBoundSpec);
    }
    {
        // types-values: var, const, arrays, maps, boxes
        var count = 0;
        count = count + 1;
        verify(count == 1, "var reassign");
        const wall = 3 * millimeter;
        verify(wall == 3 * millimeter, "const length");
        var numbers = [1, 2, 3];
        verify(numbers[0] == 1, "array index");
        var absent = undefined;
        verify(absent?[0] is undefined, "safe navigation on undefined");
        verify(size(numbers) == 3, "array size");
        // An out-of-range read throws, and try does not catch it (proved
        // twice in the Feature Studio), so the throw itself has no check here.
        var dims = { "length" : 113.5 * millimeter, "width" : 90.5 * millimeter };
        verify(dims.length == 113.5 * millimeter, "map dot access");
        verify(dims.height is undefined, "missing map key");
        var key = "length";
        verify(dims[key] == 113.5 * millimeter, "map bracket access");
        var counter = new box(0);
        counter[] = counter[] + 1;
        verify(counter[] == 1, "box");
        println("types-values: ok");

        // valuewithunits: unit arithmetic
        verify(1 * meter == 1000 * millimeter, "unit conversion");
        verify(tolerantEquals(25.4 * millimeter, 1 * inch), "mm-inch equality");
        verify((3 * meter + 1 * inch) > 3 * meter, "same-dimension add");
        verify(sqrt(4 * meter ^ 2) == 2 * meter, "sqrt of area");
        verify(((64 * foot) / (9 * inch)) is number, "units cancel to number");
        verify(tolerantEquals(1 * inch, 25.4 * millimeter), "tolerantEquals");
        println("valuewithunits: ok");

        // vectors-planes: vectors, planes, lines, transforms
        var p2 = vector(0.5, 1) * inch;
        verify(is2dPoint(p2), "is2dPoint");
        verify(p2[0] == 0.5 * inch, "vector component");
        verify(norm(vector(0, 0, 1)) == 1, "norm of direction");
        verify(dot(vector(1, 0, 0), vector(0, 1, 0)) == 0, "dot perpendicular");
        var c = cross(vector(1, 0, 0), vector(0, 1, 0));
        verify(c[2] == 1, "cross product");
        verify(tolerantEquals(angleBetween(vector(1, 0, 0), vector(0, 1, 0)), 90 * degree), "angleBetween");
        var xy = plane(vector(0, 0, 0) * millimeter, vector(0, 0, 1));
        verify(xy is Plane, "plane type");
        var axis = line(vector(0, 0, 0) * inch, vector(0, 0, 1));
        verify(axis is Line, "line type");
        verify(identityTransform() is Transform, "identityTransform");
        println("vectors-planes: ok");

        // functions: lambdas, predicates, overloading, custom types
        var doubled = (val) => val * 2;
        verify(doubled(21) == 42, "lambda");
        verify(pt(1 * millimeter, 2 * millimeter) is Vector, "pt helper");
        var stick = lumber(LumberSize.TWO_BY_FOUR, 8 * foot);
        verify(stick is Lumber, "custom type constructor");
        verify(isLumber(stick), "typecheck predicate");
        verify(LumberSize.TWO_BY_FOUR < LumberSize.TWO_BY_EIGHT, "enum order");
        verify(BoundingType.BLIND < BoundingType.THROUGH_ALL, "enum order");
        println("functions: ok");

        // control-flow and operators
        var total = 0;
        for (var j = 0; j < 3; j = j + 1) { total = total + 1; }
        verify(total == 3, "C-style for");
        var seen = [];
        for (var item in [1, 2, 3]) { seen = append(seen, item); }
        verify(size(seen) == 3, "for-in");
        var label = (count > 0) ? "positive" : "other";
        verify(label == "positive", "ternary");
        verify(2 ^ 3 == 8, "exponent");
        verify(("a" ~ "b") == "ab", "concatenation");
        verify((-7) % 3 == 2, "modulo sign of second operand");
        verify(range(0, 3)[3] == 3, "range inclusive");
        println("control-flow: ok");

        // errors: try forms. These two deliberate errors WILL show in the
        // notices flyout; that is the test working, not a failure.
        var maybe = try (0 / 0);
        verify(maybe is undefined, "try expression form");
        var caught = false;
        try { throw "deliberate test error"; } catch (e) { caught = (e == "deliberate test error"); }
        verify(caught, "try catch");
        println("errors: ok");

        // ids-context: context variables and ids
        setVariable(context, "guideTestValue", 42);
        verify(getVariable(context, "guideTestValue") == 42, "context variable");
        verify(makeId("Top") is Id, "makeId");
        println("ids-context: ok");

        // sketching: a sampler sketch using every sk* function
        var sampler = newSketchOnPlane(context, id + "sampler", {
                "sketchPlane" : plane(vector(0, 0, 0) * millimeter, vector(0, 0, 1))
            });
        skRectangle(sampler, "rect", { "firstCorner" : pt(-40 * millimeter, 20 * millimeter), "secondCorner" : pt(-20 * millimeter, 40 * millimeter) });
        skCircle(sampler, "circ", { "center" : pt(zero, 30 * millimeter), "radius" : 5 * millimeter });
        skRegularPolygon(sampler, "hex", { "center" : pt(30 * millimeter, 30 * millimeter), "firstVertex" : pt(35 * millimeter, 30 * millimeter), "sides" : 6 });
        skPolyline(sampler, "vee", { "points" : [pt(-40 * millimeter, -20 * millimeter), pt(-30 * millimeter, -10 * millimeter), pt(-20 * millimeter, -20 * millimeter)] });
        skLineSegment(sampler, "seg", { "start" : pt(zero, -20 * millimeter), "end" : pt(10 * millimeter, -10 * millimeter) });
        skArc(sampler, "arc", { "start" : pt(20 * millimeter, -20 * millimeter), "mid" : pt(25 * millimeter, -15 * millimeter), "end" : pt(30 * millimeter, -20 * millimeter) });
        skPoint(sampler, "dot", { "position" : pt(-10 * millimeter, 30 * millimeter) });
        skSolve(sampler);
        println("sketching: ok");

        // modeling: block, fillet, revolve, chamfer, union
        var blockSketch = newSketchOnPlane(context, id + "blockSketch", {
                "sketchPlane" : plane(vector(0, 0, 0) * millimeter, vector(0, 0, 1))
            });
        skRectangle(blockSketch, "rect", {
                "firstCorner" : pt(-definition.length / 2, -definition.width / 2),
                "secondCorner" : pt(definition.length / 2, definition.width / 2)
            });
        skSolve(blockSketch);
        opExtrude(context, id + "block", {
                "entities" : qSketchRegion(id + "blockSketch"),
                "direction" : vector(0, 0, 1),
                "endBound" : BoundingType.BLIND,
                "endDepth" : definition.height
            });
        opFillet(context, id + "fillet", {
                "entities" : qCreatedBy(id + "block", EntityType.EDGE),
                "radius" : definition.filletRadius
            });
        println("opExtrude + opFillet: ok");

        // The revolve axis must lie in the profile's plane. An axis
        // perpendicular to the profile spins the face in its own plane
        // and sweeps no volume: the Feature Studio refuses it with
        // "resolved face is perpendicular to axes". So the axis here is
        // the X axis, which lies in the XY sketch plane, and the profile
        // is offset from it (y 5..12 mm) so the revolve is a hollow tube,
        // not a solid cylinder. The tube overlaps the block, so the union
        // below is a real merge, not two disjoint bodies sitting next to
        // each other.
        var tubeSketch = newSketchOnPlane(context, id + "tubeSketch", {
                "sketchPlane" : plane(vector(0, 0, 0) * millimeter, vector(0, 0, 1))
            });
        skRectangle(tubeSketch, "prof", {
                "firstCorner" : pt(10 * millimeter, 5 * millimeter),
                "secondCorner" : pt(20 * millimeter, 12 * millimeter)
            });
        skSolve(tubeSketch);
        opRevolve(context, id + "tube", {
                "entities" : qSketchRegion(id + "tubeSketch"),
                "axis" : line(vector(0, 0, 0) * millimeter, vector(1, 0, 0)),
                "angleForward" : 360 * degree
            });
        opChamfer(context, id + "chamfer", {
                "entities" : qCreatedBy(id + "tube", EntityType.EDGE),
                "chamferType" : ChamferType.EQUAL_OFFSETS,
                "width" : 1 * millimeter
            });
        opBoolean(context, id + "merge", {
                "tools" : qUnion([qCreatedBy(id + "block", EntityType.BODY), qCreatedBy(id + "tube", EntityType.BODY)]),
                "operationType" : BooleanOperationType.UNION
            });
        println("opRevolve + opChamfer + opBoolean: ok");

        // loft and thicken
        var loftSk1 = newSketchOnPlane(context, id + "loftSk1", {
                "sketchPlane" : plane(vector(0, 0, 0) * millimeter, vector(0, 0, 1))
            });
        skRectangle(loftSk1, "r1", { "firstCorner" : pt(40 * millimeter, zero), "secondCorner" : pt(50 * millimeter, 10 * millimeter) });
        skSolve(loftSk1);
        var loftSk2 = newSketchOnPlane(context, id + "loftSk2", {
                "sketchPlane" : plane(vector(0, 0, 1) * (10 * millimeter), vector(0, 0, 1))
            });
        skRectangle(loftSk2, "r2", { "firstCorner" : pt(40 * millimeter, zero), "secondCorner" : pt(50 * millimeter, 10 * millimeter) });
        skSolve(loftSk2);
        opLoft(context, id + "loft", {
                "profileSubqueries" : [qSketchRegion(id + "loftSk1"), qSketchRegion(id + "loftSk2")]
            });
        opThicken(context, id + "thicken", {
                "entities" : qSketchRegion(id + "sampler"),
                "thickness1" : 2 * millimeter,
                "thickness2" : 0 * millimeter
            });
        println("opLoft + opThicken: ok");

        // queries: counts, identity, debug
        var bodies = evaluateQuery(context, qEverything(EntityType.BODY));
        println("bodies in context: " ~ toString(size(bodies)));
        var viaBlock = evaluateQuery(context, qCreatedBy(id + "block", EntityType.BODY));
        verify(size(viaBlock) == 1, "qCreatedBy finds the merged body");
        var viaMerge = evaluateQuery(context, qCreatedBy(id + "merge", EntityType.BODY));
        println("bodies found via the merge id: " ~ toString(size(viaMerge)));
        debug(context, qCreatedBy(id + "merge", EntityType.BODY));
        println("queries: ok");
        println("GUIDE TEST: ALL CHECKS PASSED");
    });
