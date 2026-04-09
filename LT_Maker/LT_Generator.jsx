/*
LT_Generator.jsx (Template Import Variant)

Workflow:
1) Show setup dialog (Client, Project Name, Duration, Frame Rate, Resolution, Template path)
2) Import template project (.aep)
3) Move imported "Lowerthirds" folder to project root
4) Remove imported wrapper folder (e.g. RB_LowerThirdsGenerator.aep)
5) Rename template names:
   - replace "STV" with selected client
   - replace "Project" with selected project name (spaces -> underscores)
6) Update duration + frame rate for all comps inside Lowerthirds
*/

(function LT_Generator_TemplateImport() {
    app.beginUndoGroup("LT Generator (Template Import)");

    var DEFAULT_TEMPLATE_PATH = "G:\\04_Library\\16_scripts\\Custom_Scripts\\AFX_EXPRESSIONS\\RB_LowerThirds_Generator\\RB_LowerThirdsGenerator.aep";

    function sanitizeProjectName(str) {
        if (!str) return "Project";
        return str.replace(/\s+/g, "_");
    }

    function resolutionToWH(label) {
        return (label === "4K") ? { w: 3840, h: 2160 } : { w: 1920, h: 1080 };
    }

    function getAllDescendants(folder) {
        var out = [];
        function walk(f) {
            if (!f || !(f instanceof FolderItem)) return;
            for (var i = 1; i <= app.project.items.length; i++) {
                var it = app.project.items[i];
                if (!it) continue;
                if (it.parentFolder === f) {
                    out.push(it);
                    if (it instanceof FolderItem) walk(it);
                }
            }
        }
        walk(folder);
        return out;
    }

    function findChildFolderByName(parentFolder, name) {
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (it instanceof FolderItem && it.parentFolder === parentFolder && it.name === name) return it;
        }
        return null;
    }

    function renameTemplateTokensInFolder(rootFolder, clientName, projectName) {
        var items = getAllDescendants(rootFolder);
        // include root itself
        items.push(rootFolder);

        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!it || !it.name) continue;

            var newName = it.name;
            newName = newName.replace(/STV/g, clientName);
            newName = newName.replace(/Project/g, projectName);

            if (newName !== it.name) {
                try { it.name = newName; } catch (eName) {}
            }
        }
    }

    function setCompTimingInFolder(rootFolder, duration, fps) {
        var items = getAllDescendants(rootFolder);
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it instanceof CompItem) {
                try { it.duration = duration; } catch (eDur) {}
                try { it.frameRate = fps; } catch (eFps) {}
            }
        }
    }

    function setCompResolutionInFolder(rootFolder, wh) {
        var items = getAllDescendants(rootFolder);
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it instanceof CompItem) {
                try {
                    it.width = wh.w;
                    it.height = wh.h;
                } catch (eWH) {}
            }
        }
    }

    function updateExpressionsInFolder(rootFolder, clientName, projectName) {
        function walkPropsAndPatch(propGroup) {
            if (!propGroup || typeof propGroup.numProperties !== "number") return;

            for (var p = 1; p <= propGroup.numProperties; p++) {
                var prop = null;
                try { prop = propGroup.property(p); } catch (eProp) {}
                if (!prop) continue;

                var hasChildren = false;
                try { hasChildren = (typeof prop.numProperties === "number" && prop.numProperties > 0); } catch (eChildren) {}
                if (hasChildren) {
                    walkPropsAndPatch(prop);
                }

                try {
                    if (prop.canSetExpression && prop.expression !== "") {
                        var oldExpr = prop.expression;
                        var newExpr = oldExpr.replace(/STV/g, clientName).replace(/Project/g, projectName);
                        if (newExpr !== oldExpr) prop.expression = newExpr;
                    }
                } catch (eExpr) {}
            }
        }

        var items = getAllDescendants(rootFolder);
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (!(it instanceof CompItem)) continue;

            for (var l = 1; l <= it.layers.length; l++) {
                var layer = null;
                try { layer = it.layers[l]; } catch (eLayer) {}
                if (!layer) continue;
                walkPropsAndPatch(layer);
            }
        }
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
        var clientDD = gClient.add("dropdownlist", undefined, ["STV", "RB", "RBMH"]);
        clientDD.selection = 0;

        var gName = p.add("group");
        gName.add("statictext", undefined, "Project Name:");
        var nameEt = gName.add("edittext", undefined, "Project");
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

        var gTpl = p.add("group");
        gTpl.orientation = "row";
        gTpl.add("statictext", undefined, "Template:");
        var tplEt = gTpl.add("edittext", undefined, DEFAULT_TEMPLATE_PATH);
        tplEt.characters = 55;
        var browseBtn = gTpl.add("button", undefined, "Browse");
        browseBtn.onClick = function () {
            var picked = File.openDialog("Select LT template project (.aep)", "*.aep");
            if (picked) tplEt.text = picked.fsName;
        };

        var btns = w.add("group");
        btns.alignment = "right";
        btns.add("button", undefined, "Import", { name: "ok" });
        btns.add("button", undefined, "Cancel", { name: "cancel" });

        if (w.show() !== 1) return null;

        return {
            client: clientDD.selection.text,
            projectName: sanitizeProjectName(nameEt.text),
            duration: parseFloat(durEt.text),
            fps: parseFloat(fpsEt.text),
            resolution: resDD.selection.text,
            templatePath: tplEt.text
        };
    }

    if (!app.project) app.newProject();

    var settings = showDialog();
    if (!settings) { app.endUndoGroup(); return; }

    if (!settings.projectName) {
        alert("Please provide a project name.");
        app.endUndoGroup();
        return;
    }
    if (isNaN(settings.duration) || settings.duration <= 0) {
        alert("Duration must be a positive number.");
        app.endUndoGroup();
        return;
    }
    if (isNaN(settings.fps) || settings.fps <= 0) {
        alert("Frame Rate must be a positive number.");
        app.endUndoGroup();
        return;
    }

    var templateFile = new File(settings.templatePath);
    if (!templateFile.exists) {
        alert("Template file not found:\n" + settings.templatePath);
        app.endUndoGroup();
        return;
    }

    var io = new ImportOptions(templateFile);
    try {
        if (io.canImportAs && io.canImportAs(ImportAsType.PROJECT)) {
            io.importAs = ImportAsType.PROJECT;
        }
    } catch (eType) {}

    var importedRoot = null;
    try {
        importedRoot = app.project.importFile(io);
    } catch (eImport) {
        alert("Failed to import template project.\n" + eImport.toString());
        app.endUndoGroup();
        return;
    }

    if (!(importedRoot instanceof FolderItem)) {
        alert("Imported template did not return a project folder item.");
        app.endUndoGroup();
        return;
    }

    var lowerthirds = findChildFolderByName(importedRoot, "Lowerthirds");
    if (!lowerthirds) {
        alert("Could not find 'Lowerthirds' inside imported template folder.");
        app.endUndoGroup();
        return;
    }

    // Move Lowerthirds folder to root and remove imported wrapper folder
    try { lowerthirds.parentFolder = app.project.rootFolder; } catch (eMove) {}

    // Update template names and timings
    renameTemplateTokensInFolder(lowerthirds, settings.client, settings.projectName);
    updateExpressionsInFolder(lowerthirds, settings.client, settings.projectName);
    setCompTimingInFolder(lowerthirds, settings.duration, settings.fps);
    setCompResolutionInFolder(lowerthirds, resolutionToWH(settings.resolution));

    // Remove wrapper folder if empty
    try {
        var hasChildren = false;
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (it && it.parentFolder === importedRoot) {
                hasChildren = true;
                break;
            }
        }
        if (!hasChildren) importedRoot.remove();
    } catch (eRm) {}

    app.endUndoGroup();
})();
