/*

KBAR / After Effects - Lower Third Builder
Version: 1.0

What this script does:
- Opens a setup dialog
- Creates:
    Lowerthirds
      |_ _Master
      |_ preComp
- Creates a master comp and the requested LT build comps
- Creates a dropdown on the master null for alignment
- Creates Essential Graphics controllers where supported
- Creates text controller layers in the master comp
- Creates LT_Main_Left always
- Creates LT_Center and LT_Right only when needed
- Supports:
    * 1 / 2 / 3 lines
    * Full HD / 4K / HD
    * Global sliders
    * Single BG or individual BGs per line
    * STV cornerbug import into root 2_Footage > Still

Notes:
- Designed for ExtendScript / AE scripting
- Some Essential Graphics calls depend on AE version
- Intended to be attached to a KBAR button or run directly

*/

(function LowerThirdBuilder_KBAR() {
    app.beginUndoGroup("Create Lower Third Base");

    // -----------------------------
    // Helpers
    // -----------------------------
    function alertAndThrow(msg) {
        alert(msg);
        throw new Error(msg);
    }

    function sanitizeName(str) {
        return str.replace(/[\\\/\:\*\?\"\<\>\|]/g, "_").replace(/\s+/g, "_");
    }

    function findItemByNameAndType(name, typeName) {
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (it && it.name === name) {
                if (typeName === "FolderItem" && it instanceof FolderItem) return it;
                if (typeName === "CompItem" && it instanceof CompItem) return it;
                if (typeName === "FootageItem" && it instanceof FootageItem) return it;
            }
        }
        return null;
    }

    function getOrCreateFolder(name, parentFolder) {
        var existing = null;

        if (parentFolder) {
            for (var i = 1; i <= app.project.items.length; i++) {
                var it = app.project.items[i];
                if (it instanceof FolderItem && it.name === name && it.parentFolder === parentFolder) {
                    existing = it;
                    break;
                }
            }
        } else {
            existing = findItemByNameAndType(name, "FolderItem");
        }

        if (existing) return existing;

        var folder = app.project.items.addFolder(name);
        if (parentFolder) folder.parentFolder = parentFolder;
        return folder;
    }

    function importFootageIfNeeded(filePath, targetFolder) {
        var f = new File(filePath);
        if (!f.exists) return null;

        var existing = null;
        for (var i = 1; i <= app.project.items.length; i++) {
            var it = app.project.items[i];
            if (it instanceof FootageItem && it.file && it.file.fsName === f.fsName) {
                existing = it;
                break;
            }
        }
        if (existing) return existing;

        var io = new ImportOptions(f);
        var footage = app.project.importFile(io);
        if (targetFolder) footage.parentFolder = targetFolder;
        return footage;
    }

    function resolutionToWH(resLabel) {
        switch (resLabel) {
            case "4K": return { w: 3840, h: 2160 };
            case "HD": return { w: 1280, h: 720 };
            case "Full HD":
            default: return { w: 1920, h: 1080 };
        }
    }

    function hasAny(arr, values) {
        for (var i = 0; i < values.length; i++) {
            for (var j = 0; j < arr.length; j++) {
                if (arr[j] === values[i]) return true;
            }
        }
        return false;
    }

    function addSlider(layer, name, value) {
        var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Slider Control");
        fx.name = name;
        fx.property(1).setValue(value);
        return fx;
    }

    function addCheckbox(layer, name, value) {
        var fx = layer.property("ADBE Effect Parade").addProperty("ADBE Checkbox Control");
        fx.name = name;
        fx.property(1).setValue(value ? 1 : 0);
        return fx;
    }

    function addDropdown(layer, name, items) {
        var fx = null;
        try {
            fx = layer.property("ADBE Effect Parade").addProperty("ADBE Dropdown Control");
        } catch (errAdd) {
            // Dropdown Control may not exist in older AE versions.
            return null;
        }
        if (!fx) return null;
        fx.name = name;
        try {
            fx.property(1).setPropertyParameters(items);
        } catch (err) {
            // older versions may fail
        }
        return fx;
    }

    function tryAddToEGP(prop, comp, label) {
        try {
            if (prop && prop.addToMotionGraphicsTemplateAs) {
                prop.addToMotionGraphicsTemplateAs(comp, label);
            } else if (prop && prop.addToMotionGraphicsTemplate) {
                prop.addToMotionGraphicsTemplate(comp);
            }
        } catch (err) {}
    }

    function makeTextLayer(comp, name, txt, fontSize, justification) {
        var layer = comp.layers.addText(txt);
        layer.name = name;

        var td = layer.property("ADBE Text Properties").property("ADBE Text Document").value;
        td.resetCharStyle();
        td.resetParagraphStyle();
        td.fontSize = fontSize;
        td.justification = justification;
        layer.property("ADBE Text Properties").property("ADBE Text Document").setValue(td);

        return layer;
    }

    function setTextExpression(layer, expr) {
        layer.property("ADBE Text Properties").property("ADBE Text Document").expression = expr;
    }

    function setTextSizeExpression(layer, expr) {
        // font size via Source Text style expression is more complex.
        // To keep it robust, we set initial size directly from script.
        // If global sliders are enabled, we still expose size sliders for later manual hookup.
        // This is intentional to avoid style-expression instability across AE versions.
    }

    function setLayerPosition(layer, pos) {
        layer.property("ADBE Transform Group").property("ADBE Position").setValue(pos);
    }

    function setLayerOpacityExpression(layer, expr) {
        layer.property("ADBE Transform Group").property("ADBE Opacity").expression = expr;
    }

    function getScaleFactor(width) {
        return width / 1920.0;
    }

    function lineBasePositions(scale, lineCount) {
        // Based on the user's requested Full HD positions:
        // 1 line: first = 1010
        // 2 lines: first = 960, second = 1010
        // 3 lines: first = 910, second = 960, third = 1010

        var firstY, secondY, thirdY;
        if (lineCount === 1) {
            firstY = 1010 * scale;
        } else if (lineCount === 2) {
            firstY = 960 * scale;
            secondY = 1010 * scale;
        } else {
            firstY = 910 * scale;
            secondY = 960 * scale;
            thirdY = 1010 * scale;
        }
        return {
            firstY: firstY,
            secondY: secondY,
            thirdY: thirdY
        };
    }

    function buildAlignIndexMap(optionsList) {
        var map = {};
        for (var i = 0; i < optionsList.length; i++) {
            map[optionsList[i]] = i + 1; // dropdown values are 1-based
        }
        return map;
    }

    function buildOpacityExprForGroup(masterCompName, groupName, idxMap) {
        var indices = [];
        if (groupName === "left") {
            if (idxMap["Top Left"]) indices.push(idxMap["Top Left"]);
            if (idxMap["Mid Left"]) indices.push(idxMap["Mid Left"]);
            if (idxMap["Bottom Left"]) indices.push(idxMap["Bottom Left"]);
        } else if (groupName === "center") {
            if (idxMap["Top Center"]) indices.push(idxMap["Top Center"]);
            if (idxMap["Mid Center"]) indices.push(idxMap["Mid Center"]);
            if (idxMap["Bottom Center"]) indices.push(idxMap["Bottom Center"]);
        } else if (groupName === "right") {
            if (idxMap["Top Right"]) indices.push(idxMap["Top Right"]);
            if (idxMap["Mid Right"]) indices.push(idxMap["Mid Right"]);
            if (idxMap["Bottom Right"]) indices.push(idxMap["Bottom Right"]);
        }

        var arrStr = "[" + indices.join(",") + "]";
        var expr =
            'var m = comp("' + masterCompName + '").layer("2.Master_Control_Null").effect("Align")("Menu");\n' +
            'var arr = ' + arrStr + ';\n' +
            'var on = false;\n' +
            'for (var i = 0; i < arr.length; i++) if (m == arr[i]) on = true;\n' +
            'on ? 100 : 0;';
        return expr;
    }

    function buildVerticalYExpression(masterCompName, idxMap, topY, midY, bottomY) {
        var topIndices = [], midIndices = [], bottomIndices = [];

        if (idxMap["Top Left"]) topIndices.push(idxMap["Top Left"]);
        if (idxMap["Top Center"]) topIndices.push(idxMap["Top Center"]);
        if (idxMap["Top Right"]) topIndices.push(idxMap["Top Right"]);

        if (idxMap["Mid Left"]) midIndices.push(idxMap["Mid Left"]);
        if (idxMap["Mid Center"]) midIndices.push(idxMap["Mid Center"]);
        if (idxMap["Mid Right"]) midIndices.push(idxMap["Mid Right"]);

        if (idxMap["Bottom Left"]) bottomIndices.push(idxMap["Bottom Left"]);
        if (idxMap["Bottom Center"]) bottomIndices.push(idxMap["Bottom Center"]);
        if (idxMap["Bottom Right"]) bottomIndices.push(idxMap["Bottom Right"]);

        return (
            'var a = comp("' + masterCompName + '").layer("2.Master_Control_Null").effect("Align")("Menu");\n' +
            'function has(v, arr){for(var i=0;i<arr.length;i++) if(v==arr[i]) return true; return false;}\n' +
            'var topArr=' + "[" + topIndices.join(",") + "]" + ';\n' +
            'var midArr=' + "[" + midIndices.join(",") + "]" + ';\n' +
            'var botArr=' + "[" + bottomIndices.join(",") + "]" + ';\n' +
            'if (has(a, topArr)) ' + topY + ';\n' +
            'else if (has(a, midArr)) ' + midY + ';\n' +
            'else ' + bottomY + ';'
        );
    }

    function buildTextPosExpr(mode, x, yExpr) {
        var xExpr = String(x);
        return '[ ' + xExpr + ', (' + yExpr + ') ]';
    }

    function addFillToShapeGroup(group, color) {
        var fill = group.content.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue(color);
        return fill;
    }

    function addRectToShapeGroup(group) {
        var rect = group.content.addProperty("ADBE Vector Shape - Rect");
        return rect;
    }

    function createIndividualBG(comp, layerName, targetTextLayerName, ctrlName, color) {
        var sh = comp.layers.addShape();
        sh.name = layerName;

        var group = sh.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        group.name = "Contents";

        var rect = addRectToShapeGroup(group);
        addFillToShapeGroup(group, color);

        rect.property("ADBE Vector Rect Size").expression =
            'var t = thisComp.layer("' + targetTextLayerName + '");\n' +
            'var sr = t.sourceRectAtTime(time,false);\n' +
            'var ctrl = thisComp.layer("' + ctrlName + '");\n' +
            'var px = 40; var py = 22;\n' +
            'try { px = ctrl.effect("Padding X")("Slider"); } catch(err) {}\n' +
            'try { py = ctrl.effect("Padding Y")("Slider"); } catch(err) {}\n' +
            '[Math.max(0, sr.width + px*2), Math.max(0, sr.height + py*2)];';

        group.property("ADBE Vector Transform Group").property("ADBE Vector Position").expression =
            'var t = thisComp.layer("' + targetTextLayerName + '");\n' +
            'var sr = t.sourceRectAtTime(time,false);\n' +
            'var p = t.transform.position;\n' +
            '[p[0] + sr.left + sr.width/2, p[1] + sr.top + sr.height/2];';

        sh.moveToEnd();
        return sh;
    }

    function createUnifiedBG(comp, layerName, textLayerNames, ctrlName, color) {
        var sh = comp.layers.addShape();
        sh.name = layerName;

        var group = sh.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
        group.name = "Contents";

        var rect = addRectToShapeGroup(group);
        addFillToShapeGroup(group, color);

        var arrStr = '["' + textLayerNames.join('","') + '"]';

        rect.property("ADBE Vector Rect Size").expression =
            'var names = ' + arrStr + ';\n' +
            'var ctrl = thisComp.layer("' + ctrlName + '");\n' +
            'var px = 40; var py = 22;\n' +
            'try { px = ctrl.effect("Padding X")("Slider"); } catch(err) {}\n' +
            'try { py = ctrl.effect("Padding Y")("Slider"); } catch(err) {}\n' +
            'var minX = 999999, minY = 999999, maxX = -999999, maxY = -999999;\n' +
            'for (var i=0; i<names.length; i++) {\n' +
            '  var t = thisComp.layer(names[i]);\n' +
            '  var sr = t.sourceRectAtTime(time,false);\n' +
            '  var p = t.transform.position;\n' +
            '  var l = p[0] + sr.left;\n' +
            '  var r = p[0] + sr.left + sr.width;\n' +
            '  var tt = p[1] + sr.top;\n' +
            '  var b = p[1] + sr.top + sr.height;\n' +
            '  minX = Math.min(minX, l); minY = Math.min(minY, tt);\n' +
            '  maxX = Math.max(maxX, r); maxY = Math.max(maxY, b);\n' +
            '}\n' +
            '[Math.max(0, (maxX-minX) + px*2), Math.max(0, (maxY-minY) + py*2)];';

        group.property("ADBE Vector Transform Group").property("ADBE Vector Position").expression =
            'var names = ' + arrStr + ';\n' +
            'var minX = 999999, minY = 999999, maxX = -999999, maxY = -999999;\n' +
            'for (var i=0; i<names.length; i++) {\n' +
            '  var t = thisComp.layer(names[i]);\n' +
            '  var sr = t.sourceRectAtTime(time,false);\n' +
            '  var p = t.transform.position;\n' +
            '  var l = p[0] + sr.left;\n' +
            '  var r = p[0] + sr.left + sr.width;\n' +
            '  var tt = p[1] + sr.top;\n' +
            '  var b = p[1] + sr.top + sr.height;\n' +
            '  minX = Math.min(minX, l); minY = Math.min(minY, tt);\n' +
            '  maxX = Math.max(maxX, r); maxY = Math.max(maxY, b);\n' +
            '}\n' +
            '[(minX+maxX)/2, (minY+maxY)/2];';

        sh.moveToEnd();
        return sh;
    }

    // -----------------------------
    // UI
    // -----------------------------
    function showDialog() {
        var w = new Window("dialog", "Create Lower Third Base");
        w.orientation = "column";
        w.alignChildren = ["fill", "top"];

        var g1 = w.add("panel", undefined, "General");
        g1.orientation = "column";
        g1.alignChildren = ["fill", "top"];

        var clientGrp = g1.add("group");
        clientGrp.add("statictext", undefined, "Client:");
        var clientDD = clientGrp.add("dropdownlist", undefined, ["STV", "RB", "RBMH", "External"]);
        clientDD.selection = 0;

        var nameGrp = g1.add("group");
        nameGrp.add("statictext", undefined, "Project Name:");
        var nameEt = nameGrp.add("edittext", undefined, "Bis ans Limit");
        nameEt.characters = 30;

        var linesGrp = g1.add("group");
        linesGrp.add("statictext", undefined, "Lines:");
        var linesDD = linesGrp.add("dropdownlist", undefined, ["1 Line", "2 Lines", "3 Lines"]);
        linesDD.selection = 1;

        var resGrp = g1.add("group");
        resGrp.add("statictext", undefined, "Resolution:");
        var resDD = resGrp.add("dropdownlist", undefined, ["Full HD", "4K", "HD"]);
        resDD.selection = 0;

        var durGrp = g1.add("group");
        durGrp.add("statictext", undefined, "Duration (s):");
        var durEt = durGrp.add("edittext", undefined, "10");
        durEt.characters = 8;

        var fpsGrp = g1.add("group");
        fpsGrp.add("statictext", undefined, "Frame Rate:");
        var fpsEt = fpsGrp.add("edittext", undefined, "30");
        fpsEt.characters = 8;

        var cbsGrp = g1.add("group");
        cbsGrp.orientation = "column";
        var globalSlidersCb = cbsGrp.add("checkbox", undefined, "Include global sliders?");
        globalSlidersCb.value = true;
        var indivBgCb = cbsGrp.add("checkbox", undefined, "Individual backgrounds for lines?");
        indivBgCb.value = true;

        var alignPanel = w.add("panel", undefined, "Alignment Options");
        alignPanel.orientation = "column";
        alignPanel.alignChildren = ["left", "top"];

        function mkRow(panel) {
            var r = panel.add("group");
            r.orientation = "row";
            return r;
        }

        var r1 = mkRow(alignPanel);
        var cbTL = r1.add("checkbox", undefined, "Top Left");
        var cbTC = r1.add("checkbox", undefined, "Top Center");
        var cbTR = r1.add("checkbox", undefined, "Top Right");

        var r2 = mkRow(alignPanel);
        var cbML = r2.add("checkbox", undefined, "Mid Left");
        var cbMC = r2.add("checkbox", undefined, "Mid Center");
        var cbMR = r2.add("checkbox", undefined, "Mid Right");

        var r3 = mkRow(alignPanel);
        var cbBL = r3.add("checkbox", undefined, "Bottom Left");
        cbBL.value = true;
        cbBL.enabled = false;
        var cbBC = r3.add("checkbox", undefined, "Bottom Center");
        var cbBR = r3.add("checkbox", undefined, "Bottom Right");

        var btns = w.add("group");
        btns.alignment = "right";
        var okBtn = btns.add("button", undefined, "Create", { name: "ok" });
        var cancelBtn = btns.add("button", undefined, "Cancel", { name: "cancel" });

        if (w.show() !== 1) return null;

        var aligns = ["Bottom Left"];
        if (cbTL.value) aligns.unshift("Top Left");
        if (cbTC.value) aligns.push("Top Center");
        if (cbTR.value) aligns.push("Top Right");
        if (cbML.value) aligns.push("Mid Left");
        if (cbMC.value) aligns.push("Mid Center");
        if (cbMR.value) aligns.push("Mid Right");
        if (cbBC.value) aligns.push("Bottom Center");
        if (cbBR.value) aligns.push("Bottom Right");

        // sort in anchor-point style order
        var allOrdered = [
            "Top Left", "Top Center", "Top Right",
            "Mid Left", "Mid Center", "Mid Right",
            "Bottom Left", "Bottom Center", "Bottom Right"
        ];
        var ordered = [];
        for (var i = 0; i < allOrdered.length; i++) {
            for (var j = 0; j < aligns.length; j++) {
                if (aligns[j] === allOrdered[i]) ordered.push(aligns[j]);
            }
        }

        return {
            client: clientDD.selection.text,
            projectName: nameEt.text,
            lines: parseInt(linesDD.selection.text.charAt(0), 10),
            resolution: resDD.selection.text,
            duration: parseFloat(durEt.text),
            fps: parseFloat(fpsEt.text),
            includeGlobalSliders: globalSlidersCb.value,
            individualBackgrounds: indivBgCb.value,
            alignments: ordered
        };
    }

    // -----------------------------
    // Build comps
    // -----------------------------
    function createMasterComp(settings, folders, wh, masterCompName, idxMap) {
        var comp = app.project.items.addComp(masterCompName, wh.w, wh.h, 1, settings.duration, settings.fps);
        comp.parentFolder = folders.master;
        comp.bgColor = [0, 0, 0];

        // STV footage if selected
        if (settings.client === "STV") {
            var rootFootageFolder = getOrCreateFolder("2_Footage", app.project.rootFolder);
            var stillFolder = getOrCreateFolder("Still", rootFootageFolder);
            var footage = importFootageIfNeeded("G:\\04_Library\\03_logos\\stv\\STV_Cornerbug_HD_Live_white.psd", stillFolder);
            if (footage) {
                var ftLayer = comp.layers.add(footage);
                ftLayer.name = "1.Footage";
                ftLayer.guideLayer = true;
                ftLayer.locked = true;

                // Fit to comp
                var sx = (wh.w / footage.width) * 100;
                var sy = (wh.h / footage.height) * 100;
                ftLayer.property("ADBE Transform Group").property("ADBE Scale").setValue([sx, sy]);
                ftLayer.property("ADBE Transform Group").property("ADBE Position").setValue([wh.w / 2, wh.h / 2]);
            }
        }

        var nullLayer = comp.layers.addNull();
        nullLayer.name = "2.Master_Control_Null";
        nullLayer.label = 9;
        nullLayer.property("ADBE Transform Group").property("ADBE Position").setValue([150, 150]);

        var alignFx = addDropdown(nullLayer, "Align", settings.alignments);
        var alignMenuProp = null;
        if (alignFx) {
            alignMenuProp = alignFx.property("Menu");
            if (!alignMenuProp) alignMenuProp = alignFx.property(1);
        }
        tryAddToEGP(alignMenuProp, comp, "Align");

        var needCenter = hasAny(settings.alignments, ["Top Center", "Mid Center", "Bottom Center"]);
        var needRight = hasAny(settings.alignments, ["Top Right", "Mid Right", "Bottom Right"]);

        // Precomp placeholders - will be replaced after actual comp creation
        var nextIndexName = 3;

        // Text controllers
        var firstText = comp.layers.addText("First Line");
        firstText.name = "First Line CTRL";
        tryAddToEGP(firstText.property("ADBE Text Properties").property("ADBE Text Document"), comp, "First Line");

        var secondText = null;
        var thirdText = null;

        if (settings.lines >= 2) {
            secondText = comp.layers.addText("Second Line");
            secondText.name = "Second Line CTRL";
            tryAddToEGP(secondText.property("ADBE Text Properties").property("ADBE Text Document"), comp, "Second Line");
        }

        if (settings.lines >= 3) {
            thirdText = comp.layers.addText("Third Line");
            thirdText.name = "Third Line CTRL";
            tryAddToEGP(thirdText.property("ADBE Text Properties").property("ADBE Text Document"), comp, "Third Line");
        }

        return comp;
    }

    function createBuildComp(mode, settings, folders, wh, masterCompName, idxMap) {
        var compName = (mode === "left") ? "LT_Main_Left" : (mode === "center") ? "LT_Center" : "LT_Right";
        var comp = app.project.items.addComp(compName, wh.w, wh.h, 1, settings.duration, settings.fps);
        comp.parentFolder = folders.precomp;
        comp.bgColor = [0, 0, 0];

        var scale = getScaleFactor(wh.w);

        var font1 = 80 * scale;
        var font23 = 50 * scale;
        var xLeft = 150 * scale;
        var xRight = wh.w - (150 * scale);
        var xCenter = wh.w / 2;

        var posData = lineBasePositions(scale, settings.lines);

        var topOffset = -800 * scale;
        var midOffset = -450 * scale;
        var botOffset = 0;

        var firstBottomY = posData.firstY;
        var secondBottomY = posData.secondY;
        var thirdBottomY = posData.thirdY;

        var firstTopY = firstBottomY + topOffset;
        var secondTopY = (settings.lines >= 2) ? secondBottomY + topOffset : 0;
        var thirdTopY = (settings.lines >= 3) ? thirdBottomY + topOffset : 0;

        var firstMidY = firstBottomY + midOffset;
        var secondMidY = (settings.lines >= 2) ? secondBottomY + midOffset : 0;
        var thirdMidY = (settings.lines >= 3) ? thirdBottomY + midOffset : 0;

        var masterCtrl = comp.layers.addNull();
        masterCtrl.name = "1. Master Control";
        masterCtrl.label = 10;
        masterCtrl.property("ADBE Transform Group").property("ADBE Position").setValue([180, 180]);

        if (settings.includeGlobalSliders) {
            addSlider(masterCtrl, "Padding X", 40 * scale);
            addSlider(masterCtrl, "Padding Y", 22 * scale);
            addSlider(masterCtrl, "Margin X", 150 * scale);
            addSlider(masterCtrl, "Font Size 1", 80 * scale);
            addSlider(masterCtrl, "Font Size 2/3", 50 * scale);
        }

        var justification =
            (mode === "left") ? ParagraphJustification.LEFT_JUSTIFY :
            (mode === "center") ? ParagraphJustification.CENTER_JUSTIFY :
            ParagraphJustification.RIGHT_JUSTIFY;

        var xVal = (mode === "left") ? xLeft : (mode === "center") ? xCenter : xRight;

        var first = makeTextLayer(comp, "2. First Line", "First Line", font1, justification);
        setTextExpression(first,
            'comp("' + masterCompName + '").layer("First Line CTRL").text.sourceText;'
        );

        var firstYExpr = buildVerticalYExpression(masterCompName, idxMap, firstTopY, firstMidY, firstBottomY);
        first.property("ADBE Transform Group").property("ADBE Position").expression = buildTextPosExpr(mode, xVal, firstYExpr);

        var second = null, third = null;
        var textNamesForUnifiedBG = ["2. First Line"];

        if (settings.lines >= 2) {
            second = makeTextLayer(comp, "3. Second Line", "Second Line", font23, justification);
            setTextExpression(second,
                'comp("' + masterCompName + '").layer("Second Line CTRL").text.sourceText;'
            );
            var secondYExpr = buildVerticalYExpression(masterCompName, idxMap, secondTopY, secondMidY, secondBottomY);
            second.property("ADBE Transform Group").property("ADBE Position").expression = buildTextPosExpr(mode, xVal, secondYExpr);
            textNamesForUnifiedBG.push("3. Second Line");
        }

        if (settings.lines >= 3) {
            third = makeTextLayer(comp, "4. Third Line", "Third Line", font23, justification);
            setTextExpression(third,
                'comp("' + masterCompName + '").layer("Third Line CTRL").text.sourceText;'
            );
            var thirdYExpr = buildVerticalYExpression(masterCompName, idxMap, thirdTopY, thirdMidY, thirdBottomY);
            third.property("ADBE Transform Group").property("ADBE Position").expression = buildTextPosExpr(mode, xVal, thirdYExpr);
            textNamesForUnifiedBG.push("4. Third Line");
        }

        var bgColor = [0, 0, 0]; // default black, easy to restyle later

        if (settings.individualBackgrounds) {
            createIndividualBG(comp, "BG First Line", "2. First Line", "1. Master Control", bgColor);
            if (settings.lines >= 2) createIndividualBG(comp, "BG Second Line", "3. Second Line", "1. Master Control", bgColor);
            if (settings.lines >= 3) createIndividualBG(comp, "BG Third Line", "4. Third Line", "1. Master Control", bgColor);
        } else {
            createUnifiedBG(comp, "BG", textNamesForUnifiedBG, "1. Master Control", bgColor);
        }

        // Keep BGs behind text
        for (var i = 1; i <= comp.layers.length; i++) {
            if (comp.layers[i].name.indexOf("BG") === 0) {
                comp.layers[i].moveToEnd();
            }
        }

        return comp;
    }

    function wireBuildCompsIntoMaster(masterComp, leftComp, centerComp, rightComp, settings, masterCompName, idxMap, wh) {
        var currentIndex = 3;

        // Left always exists
        var leftLayer = masterComp.layers.add(leftComp);
        leftLayer.name = "3.[LT_Main_Left]";
        leftLayer.property("ADBE Transform Group").property("ADBE Position").setValue([wh.w / 2, wh.h / 2]);
        setLayerOpacityExpression(leftLayer, buildOpacityExprForGroup(masterCompName, "left", idxMap));

        var needCenter = !!centerComp;
        var needRight = !!rightComp;

        if (needCenter) {
            var centerLayer = masterComp.layers.add(centerComp);
            centerLayer.name = "4.[LT_Center]";
            centerLayer.property("ADBE Transform Group").property("ADBE Position").setValue([wh.w / 2, wh.h / 2]);
            setLayerOpacityExpression(centerLayer, buildOpacityExprForGroup(masterCompName, "center", idxMap));
        }

        if (needRight) {
            var rightLayer = masterComp.layers.add(rightComp);
            rightLayer.name = needCenter ? "5.[LT_Right]" : "4.[LT_Right]";
            rightLayer.property("ADBE Transform Group").property("ADBE Position").setValue([wh.w / 2, wh.h / 2]);
            setLayerOpacityExpression(rightLayer, buildOpacityExprForGroup(masterCompName, "right", idxMap));
        }
    }

    // -----------------------------
    // Main
    // -----------------------------
    if (!app.project) app.newProject();

    var settings = showDialog();
    if (!settings) {
        app.endUndoGroup();
        return;
    }

    if (!settings.projectName || settings.projectName === "") {
        app.endUndoGroup();
        alertAndThrow("Please enter a project name.");
    }

    if (isNaN(settings.duration) || settings.duration <= 0) {
        app.endUndoGroup();
        alertAndThrow("Duration must be a positive number.");
    }

    if (isNaN(settings.fps) || settings.fps <= 0) {
        app.endUndoGroup();
        alertAndThrow("Frame Rate must be a positive number.");
    }

    var wh = resolutionToWH(settings.resolution);

    var lowerthirdsFolder = getOrCreateFolder("Lowerthirds", app.project.rootFolder);
    var masterFolder = getOrCreateFolder("_Master", lowerthirdsFolder);
    var precompFolder = getOrCreateFolder("preComp", lowerthirdsFolder);

    var folders = {
        lowerthirds: lowerthirdsFolder,
        master: masterFolder,
        precomp: precompFolder
    };

    var safeProjectName = sanitizeName(settings.projectName);
    var masterCompName = settings.client + "_" + safeProjectName + "_Lowerthirds";

    var idxMap = buildAlignIndexMap(settings.alignments);

    var masterComp = createMasterComp(settings, folders, wh, masterCompName, idxMap);

    var leftComp = createBuildComp("left", settings, folders, wh, masterCompName, idxMap);

    var centerComp = null;
    var rightComp = null;

    if (hasAny(settings.alignments, ["Top Center", "Mid Center", "Bottom Center"])) {
        centerComp = createBuildComp("center", settings, folders, wh, masterCompName, idxMap);
    }

    if (hasAny(settings.alignments, ["Top Right", "Mid Right", "Bottom Right"])) {
        rightComp = createBuildComp("right", settings, folders, wh, masterCompName, idxMap);
    }

    wireBuildCompsIntoMaster(masterComp, leftComp, centerComp, rightComp, settings, masterCompName, idxMap, wh);

    masterComp.openInViewer();

    app.endUndoGroup();
})();
