/*
KBAR / After Effects - Lower Third Builder (Simplified)

Builds a fixed LT project structure inspired by LT_Generator:
- Lowerthirds
  - _Master
    - <CLIENT>_<PROJECT>_Lowerthirds
  - preComp
    - Background_Image
    - CornerBug
    - LT_Main_Left_1_Line
    - LT_Main_Left_2_Lines
    - LT_Main_Right_1_Line
    - LT_Main_Right_2_Lines
  - Previews
    - <CLIENT>_<PROJECT>_LT_1_Line_Left_Preview
    - <CLIENT>_<PROJECT>_LT_1_Line_Right_Preview
    - <CLIENT>_<PROJECT>_LT_2_Lines_Left_Preview
    - <CLIENT>_<PROJECT>_LT_2_Lines_Right_Preview

UI options:
- Client
- Project Name
- Duration
- Frame Rate
- Resolution (Full HD or 4K)

Notes:
- All created comps use the selected duration + frame rate.
- Spaces in project name are converted to underscores.
- Existing Background / CornerBug footage is searched in project first, then imported from fallback paths.
*/

(function LowerThirdBuilder_KBAR_Simplified() {
    app.beginUndoGroup("Create Lower Third Base (Simplified)");

    function sanitizeProjectName(str) {
        if (!str) return "Project";
        return str.replace(/\s+/g, "_");
    }

    function findItemByNameAndType(name, typeName) {
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (!it || it.name !== name) continue;
            if (typeName === "FolderItem" && it instanceof FolderItem) return it;
            if (typeName === "CompItem" && it instanceof CompItem) return it;
            if (typeName === "FootageItem" && it instanceof FootageItem) return it;
        }
        return null;
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

    function resolutionToWH(label) {
        if (label === "4K") return { w: 3840, h: 2160 };
        return { w: 1920, h: 1080 };
    }

    function importFootageIfNeeded(filePath, targetFolder) {
        var f = new File(filePath);
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

    function getOrImportStillByName(fileName, fallbackPaths, stillFolder) {
        // 1) Search by item name in project first
        var existing = findItemByNameAndType(fileName, "FootageItem");
        if (existing) {
            existing.parentFolder = stillFolder;
            return existing;
        }

        // 2) Try each fallback path
        for (var i = 0; i < fallbackPaths.length; i++) {
            var item = importFootageIfNeeded(fallbackPaths[i], stillFolder);
            if (item) return item;
        }

        return null;
    }

    function addText(comp, name, text, size, justify, pos) {
        var l = comp.layers.addText(text);
        l.name = name;
        var td = l.property("ADBE Text Properties").property("ADBE Text Document").value;
        td.resetCharStyle();
        td.resetParagraphStyle();
        td.fontSize = size;
        td.justification = justify;
        l.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);
        l.property("ADBE Transform Group").property("ADBE Position").setValue(pos);
        return l;
    }

    function makeBaseComp(name, wh, duration, fps, parentFolder) {
        var c = app.project.items.addComp(name, wh.w, wh.h, 1, duration, fps);
        c.parentFolder = parentFolder;
        c.bgColor = [0, 0, 0];
        return c;
    }

    function addCenteredPrecompLayer(hostComp, sourceComp, layerName) {
        var l = hostComp.layers.add(sourceComp);
        l.name = layerName;
        l.property("ADBE Transform Group").property("ADBE Position").setValue([hostComp.width / 2, hostComp.height / 2]);
        return l;
    }

    function buildLTTextComp(name, mode, lines, wh, duration, fps, parentFolder) {
        var comp = makeBaseComp(name, wh, duration, fps, parentFolder);

        var scale = wh.w / 1920.0;
        var xLeft = 150 * scale;
        var xRight = wh.w - (150 * scale);
        var x = (mode === "left") ? xLeft : xRight;
        var just = (mode === "left") ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.RIGHT_JUSTIFY;

        // keep same visual space in 4K by scaling the FHD design positions
        var y1 = 960 * scale;
        var y2 = 1010 * scale;

        addText(comp, "First Line", "First Line", 80 * scale, just, [x, (lines === 1) ? y2 : y1]);
        if (lines >= 2) addText(comp, "Second Line", "Second Line", 50 * scale, just, [x, y2]);

        return comp;
    }

    function showDialog() {
        var w = new Window("dialog", "Create Lower Third Base");
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];

        var g = w.add("panel", undefined, "Settings");
        g.orientation = "column";
        g.alignChildren = ["fill", "top"];

        var clientGrp = g.add("group");
        clientGrp.add("statictext", undefined, "Client:");
        var clientDD = clientGrp.add("dropdownlist", undefined, ["STV", "RB", "RBMH", "External"]);
        clientDD.selection = 0;

        var nameGrp = g.add("group");
        nameGrp.add("statictext", undefined, "Project Name:");
        var nameEt = nameGrp.add("edittext", undefined, "Wir Kommen!");
        nameEt.characters = 30;

        var durGrp = g.add("group");
        durGrp.add("statictext", undefined, "Duration (s):");
        var durEt = durGrp.add("edittext", undefined, "10");
        durEt.characters = 8;

        var fpsGrp = g.add("group");
        fpsGrp.add("statictext", undefined, "Frame Rate:");
        var fpsEt = fpsGrp.add("edittext", undefined, "30");
        fpsEt.characters = 8;

        var resGrp = g.add("group");
        resGrp.add("statictext", undefined, "Resolution:");
        var resDD = resGrp.add("dropdownlist", undefined, ["Full HD", "4K"]);
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
    if (!settings) {
        app.endUndoGroup();
        return;
    }

    if (!settings.projectName || settings.projectName === "") {
        app.endUndoGroup();
        alert("Please enter a project name.");
        return;
    }
    if (isNaN(settings.duration) || settings.duration <= 0) {
        app.endUndoGroup();
        alert("Duration must be a positive number.");
        return;
    }
    if (isNaN(settings.fps) || settings.fps <= 0) {
        app.endUndoGroup();
        alert("Frame Rate must be a positive number.");
        return;
    }

    var wh = resolutionToWH(settings.resolution);

    // Folders
    var lowerthirdsFolder = getOrCreateFolder("Lowerthirds", app.project.rootFolder);
    var masterFolder = getOrCreateFolder("_Master", lowerthirdsFolder);
    var precompFolder = getOrCreateFolder("preComp", lowerthirdsFolder);
    var previewsFolder = getOrCreateFolder("Previews", lowerthirdsFolder);

    var footageRoot = getOrCreateFolder("2_Footage", app.project.rootFolder);
    var stillFolder = getOrCreateFolder("Still", footageRoot);

    var baseName = settings.client + "_" + settings.projectName;

    // Import required stills (project existing first, then fallback paths)
    var bgFootage = getOrImportStillByName("BG_Placholder.ai", [
        "G:\\04_Library\\03_logos\\stv\\BG_Placholder.ai",
        "G:\\04_Library\\03_logos\\stv\\BG_Placholder.ai"
    ], stillFolder);

    var cornerFootage = getOrImportStillByName("STV_Cornerbug_HD_Live_white.psd", [
        "G:\\04_Library\\03_logos\\stv\\STV_Cornerbug_HD_Live_white.psd"
    ], stillFolder);

    // Core precomps
    var bgComp = makeBaseComp("Background_Image", wh, settings.duration, settings.fps, precompFolder);
    if (bgFootage) {
        var bgL = bgComp.layers.add(bgFootage);
        bgL.name = "BG_Placholder";
        bgL.property("ADBE Transform Group").property("ADBE Position").setValue([wh.w / 2, wh.h / 2]);
        var sx = (wh.w / bgFootage.width) * 100;
        var sy = (wh.h / bgFootage.height) * 100;
        bgL.property("ADBE Transform Group").property("ADBE Scale").setValue([sx, sy]);
    }

    var cornerComp = makeBaseComp("CornerBug", wh, settings.duration, settings.fps, precompFolder);
    if (cornerFootage) {
        var cL = cornerComp.layers.add(cornerFootage);
        cL.name = "CornerBug";
        cL.property("ADBE Transform Group").property("ADBE Position").setValue([wh.w / 2, wh.h / 2]);
        var csx = (wh.w / cornerFootage.width) * 100;
        var csy = (wh.h / cornerFootage.height) * 100;
        cL.property("ADBE Transform Group").property("ADBE Scale").setValue([csx, csy]);
    }

    var ltLeft1 = buildLTTextComp("LT_Main_Left_1_Line", "left", 1, wh, settings.duration, settings.fps, precompFolder);
    var ltLeft2 = buildLTTextComp("LT_Main_Left_2_Lines", "left", 2, wh, settings.duration, settings.fps, precompFolder);
    var ltRight1 = buildLTTextComp("LT_Main_Right_1_Line", "right", 1, wh, settings.duration, settings.fps, precompFolder);
    var ltRight2 = buildLTTextComp("LT_Main_Right_2_Lines", "right", 2, wh, settings.duration, settings.fps, precompFolder);

    // Master
    var masterComp = makeBaseComp(baseName + "_Lowerthirds", wh, settings.duration, settings.fps, masterFolder);
    addCenteredPrecompLayer(masterComp, bgComp, "1.[Background_Image]");
    addCenteredPrecompLayer(masterComp, cornerComp, "2.[CornerBug]");
    addCenteredPrecompLayer(masterComp, ltLeft2, "3.[LT_Main_Left_2_Lines]");

    // Previews
    var p1L = makeBaseComp(baseName + "_LT_1_Line_Left_Preview", wh, settings.duration, settings.fps, previewsFolder);
    addCenteredPrecompLayer(p1L, bgComp, "Background_Image");
    addCenteredPrecompLayer(p1L, cornerComp, "CornerBug");
    addCenteredPrecompLayer(p1L, ltLeft1, "LT_Main_Left_1_Line");

    var p1R = makeBaseComp(baseName + "_LT_1_Line_Right_Preview", wh, settings.duration, settings.fps, previewsFolder);
    addCenteredPrecompLayer(p1R, bgComp, "Background_Image");
    addCenteredPrecompLayer(p1R, cornerComp, "CornerBug");
    addCenteredPrecompLayer(p1R, ltRight1, "LT_Main_Right_1_Line");

    var p2L = makeBaseComp(baseName + "_LT_2_Lines_Left_Preview", wh, settings.duration, settings.fps, previewsFolder);
    addCenteredPrecompLayer(p2L, bgComp, "Background_Image");
    addCenteredPrecompLayer(p2L, cornerComp, "CornerBug");
    addCenteredPrecompLayer(p2L, ltLeft2, "LT_Main_Left_2_Lines");

    var p2R = makeBaseComp(baseName + "_LT_2_Lines_Right_Preview", wh, settings.duration, settings.fps, previewsFolder);
    addCenteredPrecompLayer(p2R, bgComp, "Background_Image");
    addCenteredPrecompLayer(p2R, cornerComp, "CornerBug");
    addCenteredPrecompLayer(p2R, ltRight2, "LT_Main_Right_2_Lines");

    masterComp.openInViewer();

    app.endUndoGroup();
})();
