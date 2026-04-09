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
        function getCompChildren(comp) {
            var children = [];
            for (var i = 1; i <= comp.layers.length; i++) {
                var lyr = null;
                try { lyr = comp.layers[i]; } catch (eLayer) {}
                if (!lyr) continue;
                var src = null;
                try { src = lyr.source; } catch (eSrc) {}
                if (src && src instanceof CompItem) children.push(src);
            }
            return children;
        }

        function compDepth(comp, memo, visiting) {
            if (memo[comp.id] !== undefined) return memo[comp.id];
            if (visiting[comp.id]) return 0;
            visiting[comp.id] = true;
            var children = getCompChildren(comp);
            var maxChild = -1;
            for (var i = 0; i < children.length; i++) {
                maxChild = Math.max(maxChild, compDepth(children[i], memo, visiting));
            }
            visiting[comp.id] = false;
            memo[comp.id] = maxChild + 1;
            return memo[comp.id];
        }

        function scaleLayerTransforms(comp, ratioX, ratioY) {
            for (var i = 1; i <= comp.layers.length; i++) {
                var lyr = null;
                try { lyr = comp.layers[i]; } catch (eLayer) {}
                if (!lyr) continue;

                var wasLocked = false;
                try { wasLocked = lyr.locked; } catch (eLock) {}
                if (wasLocked) {
                    try { lyr.locked = false; } catch (eUnlock) {}
                }

                try {
                    var posProp = lyr.property("ADBE Transform Group").property("ADBE Position");
                    if (posProp && posProp.numKeys === 0) {
                        var p = posProp.value;
                        posProp.setValue([p[0] * ratioX, p[1] * ratioY]);
                    }
                } catch (ePos) {}

                try {
                    var anchorProp = lyr.property("ADBE Transform Group").property("ADBE Anchor Point");
                    if (anchorProp && anchorProp.numKeys === 0) {
                        var a = anchorProp.value;
                        anchorProp.setValue([a[0] * ratioX, a[1] * ratioY]);
                    }
                } catch (eAnchor) {}

                try {
                    var src = lyr.source;
                    var isPrecompLayer = (src && src instanceof CompItem);
                    if (!isPrecompLayer) {
                        var scaleProp = lyr.property("ADBE Transform Group").property("ADBE Scale");
                        if (scaleProp && scaleProp.numKeys === 0) {
                            var s = scaleProp.value;
                            scaleProp.setValue([s[0] * ratioX, s[1] * ratioY]);
                        }
                    }
                } catch (eScale) {}

                if (wasLocked) {
                    try { lyr.locked = true; } catch (eRelock) {}
                }
            }
        }

        function tryScaleCompositionWithBuiltIn(comp, targetW, targetH) {
            // Try to use AE's built-in Scale Composition script if available.
            // Fallback to manual transform scaling when this is not callable.
            var scriptFile = null;
            try { scriptFile = new File(app.path.fsName + "/Scripts/Scale Composition.jsx"); } catch (ePath) {}
            if (!scriptFile || !scriptFile.exists) return false;

            var scaled = false;
            try {
                var prevDialogs = app.beginSuppressDialogs();
                try {
                    // Some AE installs expose a callable function after evalFile.
                    $.evalFile(scriptFile);
                    if (typeof ScaleComposition === "function") {
                        ScaleComposition(comp, targetW, targetH);
                        scaled = true;
                    } else if (typeof scaleComposition === "function") {
                        scaleComposition(comp, targetW, targetH);
                        scaled = true;
                    }
                } catch (eEval) {}
                app.endSuppressDialogs(false);
            } catch (eSuppress) {}
            return scaled;
        }

        var items = getAllDescendants(rootFolder);
        var comps = [];
        for (var c = 0; c < items.length; c++) {
            if (items[c] instanceof CompItem) comps.push(items[c]);
        }

        var memo = {};
        var visiting = {};
        for (var d = 0; d < comps.length; d++) compDepth(comps[d], memo, visiting);

        comps.sort(function (a, b) {
            return memo[a.id] - memo[b.id]; // children first
        });

        for (var i = 0; i < comps.length; i++) {
            var comp = comps[i];
            var oldW = comp.width;
            var oldH = comp.height;
            if (oldW === wh.w && oldH === wh.h) continue;

            var ratioX = wh.w / oldW;
            var ratioY = wh.h / oldH;

            var usedBuiltIn = tryScaleCompositionWithBuiltIn(comp, wh.w, wh.h);
            if (!usedBuiltIn) {
                // Bottom-up fallback to avoid unnecessary precomp scale inflation.
                scaleLayerTransforms(comp, ratioX, ratioY);
                try {
                    comp.width = wh.w;
                    comp.height = wh.h;
                } catch (eWH) {}
            }
        }
    }

    function adjustLayersAndKeyframesInFolder(rootFolder, duration) {
        function retimeFourKeyProperty(prop, newDuration) {
            var keyCount = 0;
            try { keyCount = prop.numKeys; } catch (eCount) { return; }
            if (keyCount !== 4) return;

            var exprEnabled = false;
            try { exprEnabled = prop.expressionEnabled; } catch (eExprState) {}
            if (exprEnabled) return;

            var values = [];
            var times = [];
            var keyMeta = [];
            try {
                for (var k = 1; k <= 4; k++) {
                    values.push(prop.keyValue(k));
                    times.push(prop.keyTime(k));

                    var meta = {};
                    try { meta.inInterp = prop.keyInInterpolationType(k); } catch (eInInterp) {}
                    try { meta.outInterp = prop.keyOutInterpolationType(k); } catch (eOutInterp) {}
                    try { meta.inEase = prop.keyInTemporalEase(k); } catch (eInEase) {}
                    try { meta.outEase = prop.keyOutTemporalEase(k); } catch (eOutEase) {}
                    try { meta.temporalContinuous = prop.keyTemporalContinuous(k); } catch (eTCont) {}
                    try { meta.temporalAutoBezier = prop.keyTemporalAutoBezier(k); } catch (eTAuto) {}
                    try { meta.roving = prop.keyRoving(k); } catch (eRove) {}
                    try { meta.spatialContinuous = prop.keySpatialContinuous(k); } catch (eSCont) {}
                    try { meta.spatialAutoBezier = prop.keySpatialAutoBezier(k); } catch (eSAuto) {}
                    try { meta.inSpatialTangent = prop.keyInSpatialTangent(k); } catch (eInTan) {}
                    try { meta.outSpatialTangent = prop.keyOutSpatialTangent(k); } catch (eOutTan) {}
                    keyMeta.push(meta);
                }
            } catch (eRead) { return; }

            var t3 = Math.max(0, newDuration - 1);
            var t4 = Math.max(0, newDuration);
            times[2] = t3;
            times[3] = t4;

            // Ensure non-decreasing key times
            if (times[2] < times[1]) times[2] = times[1];
            if (times[3] < times[2]) times[3] = times[2];

            try {
                for (var r = 4; r >= 1; r--) prop.removeKey(r);
                for (var a = 0; a < 4; a++) prop.setValueAtTime(times[a], values[a]);

                for (var m = 1; m <= 4; m++) {
                    var km = keyMeta[m - 1];
                    if (!km) continue;
                    try { if (km.inInterp !== undefined && km.outInterp !== undefined) prop.setInterpolationTypeAtKey(m, km.inInterp, km.outInterp); } catch (eSetInterp) {}
                    try { if (km.inEase !== undefined && km.outEase !== undefined) prop.setTemporalEaseAtKey(m, km.inEase, km.outEase); } catch (eSetEase) {}
                    try { if (km.temporalContinuous !== undefined) prop.setTemporalContinuousAtKey(m, km.temporalContinuous); } catch (eSetTCont) {}
                    try { if (km.temporalAutoBezier !== undefined) prop.setTemporalAutoBezierAtKey(m, km.temporalAutoBezier); } catch (eSetTAuto) {}
                    try { if (km.spatialContinuous !== undefined) prop.setSpatialContinuousAtKey(m, km.spatialContinuous); } catch (eSetSCont) {}
                    try { if (km.spatialAutoBezier !== undefined) prop.setSpatialAutoBezierAtKey(m, km.spatialAutoBezier); } catch (eSetSAuto) {}
                    try { if (km.inSpatialTangent !== undefined && km.outSpatialTangent !== undefined) prop.setSpatialTangentsAtKey(m, km.inSpatialTangent, km.outSpatialTangent); } catch (eSetTan) {}
                    // Roving is valid only for interior keys.
                    if (m > 1 && m < 4) {
                        try { if (km.roving !== undefined) prop.setRovingAtKey(m, km.roving); } catch (eSetRove) {}
                    }
                }
            } catch (eWrite) {}
        }

        function walkPropsAndAdjust(propGroup, newDuration) {
            if (!propGroup || typeof propGroup.numProperties !== "number") return;

            for (var p = 1; p <= propGroup.numProperties; p++) {
                var prop = null;
                try { prop = propGroup.property(p); } catch (eProp) {}
                if (!prop) continue;

                var hasChildren = false;
                try { hasChildren = (typeof prop.numProperties === "number" && prop.numProperties > 0); } catch (eChildren) {}
                if (hasChildren) walkPropsAndAdjust(prop, newDuration);

                retimeFourKeyProperty(prop, newDuration);
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

                var wasLocked = false;
                try { wasLocked = layer.locked; } catch (eLockRead) {}
                if (wasLocked) {
                    try { layer.locked = false; } catch (eUnlock) {}
                }

                try { layer.outPoint = duration; } catch (eOut) {}
                walkPropsAndAdjust(layer, duration);

                if (wasLocked) {
                    try { layer.locked = true; } catch (eRelock) {}
                }
            }
        }
    }

    function findCompByNameInFolder(rootFolder, compName) {
        var items = getAllDescendants(rootFolder);
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it instanceof CompItem && it.name === compName) return it;
        }
        return null;
    }

    function importBackgroundTopLayer(lowerthirdsFolder, imagePath) {
        if (!imagePath || imagePath === "") return;

        var f = new File(imagePath);
        if (!f.exists) return;

        var footage = null;
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) {
                footage = it;
                break;
            }
        }
        if (!footage) {
            try {
                var io = new ImportOptions(f);
                footage = app.project.importFile(io);
            } catch (eImportBG) {}
        }
        if (!footage) return;

        var bgComp = findCompByNameInFolder(lowerthirdsFolder, "Background_Image");
        if (!bgComp) return;

        var l = null;
        try { l = bgComp.layers.add(footage); } catch (eAddLayer) {}
        if (!l) return;

        l.name = "User_BG_Image";
        try { l.moveToBeginning(); } catch (eTop) {}
        try { l.property("ADBE Transform Group").property("ADBE Position").setValue([bgComp.width / 2, bgComp.height / 2]); } catch (ePos) {}
        try {
            var sx = (bgComp.width / footage.width) * 100;
            var sy = (bgComp.height / footage.height) * 100;
            l.property("ADBE Transform Group").property("ADBE Scale").setValue([sx, sy]);
        } catch (eScale) {}
    }

    function updateMasterProtectedRegions(lowerthirdsFolder, duration) {
        var items = getAllDescendants(lowerthirdsFolder);
        var master = null;
        for (var i = 0; i < items.length; i++) {
            var it = items[i];
            if (it instanceof CompItem && /_Lowerthirds$/.test(it.name)) {
                master = it;
                break;
            }
        }
        if (!master) return;

        var mp = null;
        try { mp = master.markerProperty; } catch (eMP) {}
        if (!mp) return;

        try {
            for (var r = mp.numKeys; r >= 1; r--) mp.removeKey(r);
        } catch (eClear) {}

        var firstStart = 0;
        var firstDur = Math.min(1, duration);
        var lastStart = Math.max(0, duration - 1);
        var lastDur = Math.min(1, duration - lastStart);

        try {
            var m1 = new MarkerValue("Protected_Start");
            m1.duration = firstDur;
            m1.protectedRegion = true;
            mp.setValueAtTime(firstStart, m1);
        } catch (eM1) {}

        try {
            var m2 = new MarkerValue("Protected_End");
            m2.duration = lastDur;
            m2.protectedRegion = true;
            mp.setValueAtTime(lastStart, m2);
        } catch (eM2) {}
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
        var durEt = gDur.add("edittext", undefined, "5");
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

        var gBg = p.add("group");
        gBg.orientation = "row";
        gBg.add("statictext", undefined, "BG Image:");
        var bgEt = gBg.add("edittext", undefined, "");
        bgEt.characters = 55;
        var bgBrowseBtn = gBg.add("button", undefined, "Browse");
        bgBrowseBtn.onClick = function () {
            var pickedBg = File.openDialog("Select background image", "*.png;*.jpg;*.jpeg;*.psd;*.tif;*.tiff;*.ai");
            if (pickedBg) bgEt.text = pickedBg.fsName;
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
            templatePath: tplEt.text,
            backgroundImagePath: bgEt.text
        };
    }

    try {
        if (!app.project) app.newProject();

        var settings = showDialog();
        if (!settings) return;

        if (!settings.projectName) {
            alert("Please provide a project name.");
            return;
        }
        if (isNaN(settings.duration) || settings.duration <= 0) {
            alert("Duration must be a positive number.");
            return;
        }
        if (isNaN(settings.fps) || settings.fps <= 0) {
            alert("Frame Rate must be a positive number.");
            return;
        }

        var templateFile = new File(settings.templatePath);
        if (!templateFile.exists) {
            alert("Template file not found:\n" + settings.templatePath);
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
            return;
        }

        if (!(importedRoot instanceof FolderItem)) {
            alert("Imported template did not return a project folder item.");
            return;
        }

        var lowerthirds = findChildFolderByName(importedRoot, "Lowerthirds");
        if (!lowerthirds) {
            alert("Could not find 'Lowerthirds' inside imported template folder.");
            return;
        }

        // Move Lowerthirds folder to root and remove imported wrapper folder
        try { lowerthirds.parentFolder = app.project.rootFolder; } catch (eMove) {}

        // Update template names and timings
        renameTemplateTokensInFolder(lowerthirds, settings.client, settings.projectName);
        updateExpressionsInFolder(lowerthirds, settings.client, settings.projectName);
        setCompTimingInFolder(lowerthirds, settings.duration, settings.fps);
        setCompResolutionInFolder(lowerthirds, resolutionToWH(settings.resolution));
        adjustLayersAndKeyframesInFolder(lowerthirds, settings.duration);
        importBackgroundTopLayer(lowerthirds, settings.backgroundImagePath);
        updateMasterProtectedRegions(lowerthirds, settings.duration);

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
    } finally {
        app.endUndoGroup();
    }
})();
