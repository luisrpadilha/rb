/*
LT_Generator.jsx
Builds a Lower Third project scaffold with fixed structure and deterministic layer/expression setup.

Inputs:
- Client
- Project Name
- Duration
- Frame Rate
- Resolution (Full HD / 4K)

All created comps use the selected Duration + Frame Rate.
*/

(function LT_Generator() {
    app.beginUndoGroup("LT Generator");

    function sanitizeProjectName(str) {
        if (!str) return "Project";
        return str.replace(/\s+/g, "_");
    }

    function resolutionToWH(label) {
        return (label === "4K") ? { w: 3840, h: 2160 } : { w: 1920, h: 1080 };
    }

    function findFootageByName(name) {
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (it instanceof FootageItem && it.name === name) return it;
        }
        return null;
    }

    function importFootageIfNeeded(path, targetFolder) {
        var f = new File(path);
        if (!f.exists) return null;

        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) {
                if (targetFolder) it.parentFolder = targetFolder;
                return it;
            }
        }

        var io = new ImportOptions(f);
        var footage = app.project.importFile(io);
        if (targetFolder) footage.parentFolder = targetFolder;
        return footage;
    }

    function getOrCreateFolder(name, parentFolder) {
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (it instanceof FolderItem && it.name === name && it.parentFolder === parentFolder) return it;
        }
        var f = app.project.items.addFolder(name);
        f.parentFolder = parentFolder;
        return f;
    }

    function makeComp(name, wh, duration, fps, folder) {
        var c = app.project.items.addComp(name, wh.w, wh.h, 1, duration, fps);
        c.parentFolder = folder;
        c.bgColor = [0, 0, 0];
        return c;
    }

    function addTextLayer(comp, name, text, fontSize, justification, pos) {
        var l = comp.layers.addText(text);
        l.name = name;
        var td = l.property("ADBE Text Properties").property("ADBE Text Document").value;
        td.resetCharStyle();
        td.resetParagraphStyle();
        td.fontSize = fontSize;
        td.justification = justification;
        l.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
        l.property("ADBE Transform Group").property("ADBE Position").setValue(pos);
        return l;
    }

    function addCenteredCompLayer(host, source, name) {
        var l = host.layers.add(source);
        l.name = name;
        l.property("ADBE Transform Group").property("ADBE Position").setValue([host.width / 2, host.height / 2]);
        return l;
    }

    function addSlider(layer, name, val) {
        var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
        fx.name = name;
        fx.property(1).setValue(val);
        return fx;
    }

    function addBGForText(comp, name, textLayerName, ctrlName) {
        var shape = comp.layers.addShape();
        shape.name = name;

        var root = shape.property("ADBE Root Vectors Group");
        var grp = root.addProperty("ADBE Vector Group");
        grp.name = "Contents";

        var vecs = grp.property("ADBE Vectors Group");
        var rect = vecs.addProperty("ADBE Vector Shape - Rect");
        var fill = vecs.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue([0, 0, 0]);

        rect.property("ADBE Vector Rect Size").expression =
            'var t = thisComp.layer("' + textLayerName + '");\n' +
            'var sr = t.sourceRectAtTime(time,false);\n' +
            'var c = thisComp.layer("' + ctrlName + '");\n' +
            'var px = c.effect("Padding X")("Slider");\n' +
            'var py = c.effect("Padding Y")("Slider");\n' +
            '[Math.max(0, sr.width + px*2), Math.max(0, sr.height + py*2)];';

        grp.property("ADBE Vector Transform Group").property("ADBE Vector Position").expression =
            'var t = thisComp.layer("' + textLayerName + '");\n' +
            'var sr = t.sourceRectAtTime(time,false);\n' +
            'var p = t.transform.position;\n' +
            '[p[0] + sr.left + sr.width/2, p[1] + sr.top + sr.height/2];';

        shape.moveToEnd();
        return shape;
    }

    function buildLTComp(name, side, lineCount, wh, duration, fps, folder, masterCompName) {
        var comp = makeComp(name, wh, duration, fps, folder);
        var scale = wh.w / 1920.0;

        var ctrl = comp.layers.addNull();
        ctrl.name = "1. Master Control";
        ctrl.label = 10;
        ctrl.property("ADBE Transform Group").property("ADBE Position").setValue([180 * scale, 180 * scale]);
        addSlider(ctrl, "Padding X", 40 * scale);
        addSlider(ctrl, "Padding Y", 22 * scale);

        var just = (side === "left") ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.RIGHT_JUSTIFY;
        var x = (side === "left") ? (150 * scale) : (wh.w - 150 * scale);

        var yTop = 960 * scale;
        var yBottom = 1010 * scale;

        var first = addTextLayer(comp, "2. First Line", "First Line", 80 * scale, just, [x, (lineCount === 1 ? yBottom : yTop)]);
        first.property("ADBE Text Properties").property("ADBE Text Document").expression =
            'comp("' + masterCompName + '").layer("First Line CTRL").text.sourceText;';

        addBGForText(comp, "BG First Line", "2. First Line", "1. Master Control");

        if (lineCount >= 2) {
            var second = addTextLayer(comp, "3. Second Line", "Second Line", 50 * scale, just, [x, yBottom]);
            second.property("ADBE Text Properties").property("ADBE Text Document").expression =
                'comp("' + masterCompName + '").layer("Second Line CTRL").text.sourceText;';
            addBGForText(comp, "BG Second Line", "3. Second Line", "1. Master Control");
        }

        return comp;
    }

    function showDialog() {
        var w = new Window("dialog", "LT Generator");
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];

        var p = w.add("panel", undefined, "Settings");
        p.orientation = "column";
        p.alignChildren = ["fill", "top"];

        var gClient = p.add("group");
        gClient.add("statictext", undefined, "Client:");
        var clientDD = gClient.add("dropdownlist", undefined, ["STV_WM", "STV", "RB", "RBMH", "External"]);
        clientDD.selection = 0;

        var gName = p.add("group");
        gName.add("statictext", undefined, "Project Name:");
        var nameEt = gName.add("edittext", undefined, "Wir Kommen!");
        nameEt.characters = 30;

        var gDur = p.add("group");
        gDur.add("statictext", undefined, "Duration (s):");
        var durEt = gDur.add("edittext", undefined, "10");
        durEt.characters = 8;

        var gFps = p.add("group");
        gFps.add("statictext", undefined, "Frame Rate:");
        var fpsEt = gFps.add("edittext", undefined, "30");
        fpsEt.characters = 8;

        var gRes = p.add("group");
        gRes.add("statictext", undefined, "Resolution:");
        var resDD = gRes.add("dropdownlist", undefined, ["Full HD", "4K"]);
        resDD.selection = 0;

        var btns = w.add("group");
        btns.alignment = "right";
        btns.add("button", undefined, "Create", { name: "ok" });
        btns.add("button", undefined, "Cancel", { name: "cancel" });

        if (w.show() !== 1) return null;

        return {
            client: clientDD.selection.text,
            projectName: sanitizeProjectName(nameEt.text),
            duration: parseFloat(durEt.text),
            fps: parseFloat(fpsEt.text),
            resolution: resDD.selection.text
        };
    }

    if (!app.project) app.newProject();

    var settings = showDialog();
    if (!settings) { app.endUndoGroup(); return; }

    if (!settings.projectName) { alert("Please provide project name."); app.endUndoGroup(); return; }
    if (isNaN(settings.duration) || settings.duration <= 0) { alert("Duration must be > 0"); app.endUndoGroup(); return; }
    if (isNaN(settings.fps) || settings.fps <= 0) { alert("Frame rate must be > 0"); app.endUndoGroup(); return; }

    var wh = resolutionToWH(settings.resolution);

    var lowerthirds = getOrCreateFolder("Lowerthirds", app.project.rootFolder);
    var masterFolder = getOrCreateFolder("_Master", lowerthirds);
    var preCompFolder = getOrCreateFolder("preComp", lowerthirds);
    var previewsFolder = getOrCreateFolder("Previews", lowerthirds);

    var footageRoot = getOrCreateFolder("2_Footage", app.project.rootFolder);
    var stillFolder = getOrCreateFolder("Still", footageRoot);

    var baseName = settings.client + "_" + settings.projectName;
    var masterCompName = baseName + "_Lowerthirds";

    var bgItem = findFootageByName("BG_Placholder.ai") || importFootageIfNeeded("G:\\04_Library\\03_logos\\stv\\BG_Placholder.ai", stillFolder);
    if (bgItem) bgItem.parentFolder = stillFolder;

    var cornerItem = findFootageByName("STV_Cornerbug_HD_Live_white.psd") || importFootageIfNeeded("G:\\04_Library\\03_logos\\stv\\STV_Cornerbug_HD_Live_white.psd", stillFolder);
    if (cornerItem) cornerItem.parentFolder = stillFolder;

    var backgroundComp = makeComp("Background_Image", wh, settings.duration, settings.fps, preCompFolder);
    if (bgItem) {
        var bgL = backgroundComp.layers.add(bgItem);
        bgL.name = "BG_Placholder";
        bgL.property("ADBE Transform Group").property("ADBE Position").setValue([wh.w / 2, wh.h / 2]);
        bgL.property("ADBE Transform Group").property("ADBE Scale").setValue([(wh.w / bgItem.width) * 100, (wh.h / bgItem.height) * 100]);
    }

    var cornerComp = makeComp("CornerBug", wh, settings.duration, settings.fps, preCompFolder);
    if (cornerItem) {
        var cL = cornerComp.layers.add(cornerItem);
        cL.name = "CornerBug";
        cL.property("ADBE Transform Group").property("ADBE Position").setValue([wh.w / 2, wh.h / 2]);
        cL.property("ADBE Transform Group").property("ADBE Scale").setValue([(wh.w / cornerItem.width) * 100, (wh.h / cornerItem.height) * 100]);
    }

    var ltLeft1 = buildLTComp("LT_Main_Left_1_Line", "left", 1, wh, settings.duration, settings.fps, preCompFolder, masterCompName);
    var ltLeft2 = buildLTComp("LT_Main_Left_2_Lines", "left", 2, wh, settings.duration, settings.fps, preCompFolder, masterCompName);
    var ltRight1 = buildLTComp("LT_Main_Right_1_Line", "right", 1, wh, settings.duration, settings.fps, preCompFolder, masterCompName);
    var ltRight2 = buildLTComp("LT_Main_Right_2_Lines", "right", 2, wh, settings.duration, settings.fps, preCompFolder, masterCompName);

    var masterComp = makeComp(masterCompName, wh, settings.duration, settings.fps, masterFolder);

    var firstCtrl = masterComp.layers.addText("First Line");
    firstCtrl.name = "First Line CTRL";
    var secondCtrl = masterComp.layers.addText("Second Line");
    secondCtrl.name = "Second Line CTRL";

    addCenteredCompLayer(masterComp, backgroundComp, "1.[Background_Image]");
    addCenteredCompLayer(masterComp, cornerComp, "2.[CornerBug]");
    addCenteredCompLayer(masterComp, ltLeft2, "3.[LT_Main_Left_2_Lines]");

    var p1L = makeComp(baseName + "_LT_1_Line_Left_Preview", wh, settings.duration, settings.fps, previewsFolder);
    addCenteredCompLayer(p1L, backgroundComp, "Background_Image");
    addCenteredCompLayer(p1L, cornerComp, "CornerBug");
    addCenteredCompLayer(p1L, ltLeft1, "LT_Main_Left_1_Line");

    var p1R = makeComp(baseName + "_LT_1_Line_Right_Preview", wh, settings.duration, settings.fps, previewsFolder);
    addCenteredCompLayer(p1R, backgroundComp, "Background_Image");
    addCenteredCompLayer(p1R, cornerComp, "CornerBug");
    addCenteredCompLayer(p1R, ltRight1, "LT_Main_Right_1_Line");

    var p2L = makeComp(baseName + "_LT_2_Lines_Left_Preview", wh, settings.duration, settings.fps, previewsFolder);
    addCenteredCompLayer(p2L, backgroundComp, "Background_Image");
    addCenteredCompLayer(p2L, cornerComp, "CornerBug");
    addCenteredCompLayer(p2L, ltLeft2, "LT_Main_Left_2_Lines");

    var p2R = makeComp(baseName + "_LT_2_Lines_Right_Preview", wh, settings.duration, settings.fps, previewsFolder);
    addCenteredCompLayer(p2R, backgroundComp, "Background_Image");
    addCenteredCompLayer(p2R, cornerComp, "CornerBug");
    addCenteredCompLayer(p2R, ltRight2, "LT_Main_Right_2_Lines");

    masterComp.openInViewer();

    app.endUndoGroup();
})();
