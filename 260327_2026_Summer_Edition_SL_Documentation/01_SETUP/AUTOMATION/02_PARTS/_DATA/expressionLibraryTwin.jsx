{
    "nameCheck": function(dataLayer, part) {
        // Returns 100 if the input layer name in the "DATA-Twin" comp and input layerName.split("_")[part] match
        const dataText = thisLayer.comp("DATA-Twin").layer(dataLayer).text.sourceText.toLowerCase();
        const layerNamePart = thisLayer.name.split("_")[part].toLowerCase();
        if (dataText === layerNamePart) {
            return 100;
        } else {
            return 0;
        }
    },
    "variantCheck": function() { //used in all global comps + EDITIONS MAIN
        const variantSource = thisLayer.comp("DATA-Twin").layer("VARIANT").text.sourceText.toLowerCase();
        const layerVariant = thisLayer.name.split("_")[0].toLowerCase();
        if (variantSource == layerVariant) { return 100 } else { return 0 };
    },
    "productNameCheck": function() { //Checks string after first Underscore
        const nameSource = thisLayer.comp("DATA-Twin").layer("PRODUCT NAME").text.sourceText.toLowerCase();
        const layerName = thisLayer.name.split("_")[1].toLowerCase();
        const layerSF = layerName + " sugarfree";
        if (nameSource == layerName || nameSource == layerSF) { return 100 } else { return 0 };
    },
    "countryCheck": function() { // only for Variants text bottom, also checks label Type
        const data = thisLayer.footage("labelData.json").sourceData;

        const basicLabel = data.variables.basicLabel;
        const labelSource = thisLayer.comp("DATA-Twin").layer("LABEL TYPE").text.sourceText.toLowerCase();

        var countrySource = thisLayer.comp("DATA-Twin").layer("COUNTRY").text.sourceText.toLowerCase();
        var layerCountry = thisLayer.name.split("_")[0].toLowerCase();

        if (countrySource == layerCountry && !basicLabel.includes(labelSource)) { return 100 } else { return 0 };
    },
    "countryVariantCheck": function() { //used for Brazil & Turkey because their Bottom Text is also Variant dependend
        const data = thisLayer.footage("labelData.json").sourceData;

        const basicLabel = data.variables.basicLabel;
        const labelSource = thisLayer.comp("DATA-Twin").layer("LABEL TYPE").text.sourceText.toLowerCase();

        var layerVariant = thisLayer.name.split("_")[3].toLowerCase();
        var sfVariant = "sf-" + layerVariant;
        var variantArray = [sfVariant, layerVariant];
        var countrySource = thisLayer.comp("DATA-Twin").layer("COUNTRY").text.sourceText.toLowerCase();
        var variantSource = thisLayer.comp("DATA-Twin").layer("VARIANT").text.sourceText.toLowerCase();

        var layerCountry = thisLayer.name.split("_")[0].toLowerCase();

        if (countrySource == layerCountry && !basicLabel.includes(labelSource) && variantArray.includes(variantSource)) { return 100 } else { return 0 };
    },
    "productNameCheckFirst": function() { // checks Product Name on string before first Underscore
        const nameSource = thisLayer.comp("DATA-Twin").layer("PRODUCT NAME").text.sourceText.toLowerCase();
        const layerName = thisLayer.name.split("_")[0].toLowerCase();
        const layerSF = layerName + " sugarfree";
        if (nameSource == layerName || nameSource == layerSF) { return 100 } else { return 0 };
    },
    "countryOnlyCheck": function() { // checks only country (for rhombus text bottom for example)
        var countrySource = thisLayer.comp("DATA-Twin").layer("COUNTRY").text.sourceText.toLowerCase();
        var layerCountry = thisLayer.name.split("_")[0].toLowerCase();

        if (countrySource == layerCountry) { return 100 } else { return 0 };
    },
    "rhombusCheck": function() { //check if any of the layers above this layer have opacitiy of 100
        var thisLayerIndex = thisLayer.index;
        var opacityFound = false;

        for (var i = 1; i < thisLayerIndex; i++) {
            if (thisComp.layer(i).transform.opacity.value == 100) {
                opacityFound = true;
                break;
            }
            else { false }
        }

        if (opacityFound) { return 0 } else { return 100 };
    },
    "tabCheck": function(countryCode) { //checks input country and layerVariant at first place
        const variantSource = thisLayer.comp("DATA-Twin").layer("VARIANT").text.sourceText.toLowerCase();
        const layerVariant = thisLayer.name.split("_")[0].toLowerCase();
        var countrySource = thisLayer.comp("DATA-Twin").layer("COUNTRY").text.sourceText.toLowerCase();

        if (countrySource == countryCode.toLowerCase() && layerVariant == variantSource) { return 100 } else { return 0 };
    },
    "sfCheck": function() {
        const variantSource = thisLayer.comp("DATA-Twin").layer("VARIANT").text.sourceText.toLowerCase();
        const sfCheck = variantSource.split("-")[0];

        if (sfCheck == "sf") { return 100 } else { return 0 };
    },
    "audioCheck": function() {
        const soundCheck = thisLayer.comp("DATA-Twin").layer("AUDIO ON/OFF").text.sourceText.toLowerCase();
        if (soundCheck !== "off") { return [0, 0]} else { return [-192, -192]};
    },
    "actualVariant": function() { //returns actual variant no matter if its SF variant or consumer activation or normal
        const variantSource = thisLayer.comp("DATA-Twin").layer("VARIANT").text.sourceText.toLowerCase();
        var variantResult;
        if (variantSource.includes("sf-")) {
            variantResult = variantSource.split("-")[1];
        } else if (variantSource.includes("-ca")) {
            variantResult = variantSource.split("-")[0];
        } else {
            variantResult = variantSource;
        }
        return variantResult;
    },
    "labelColor": function() { //returns hex color for the colored can label based on the variant and layer color
        try {
            if (thisLayer.transform.opacity !== 0) {
                const lib = thisLayer.footage("expressionLibrary.jsx").sourceData;
                const data = thisLayer.footage("labelColors.json").sourceData;
                const variant = lib.actualVariant().toUpperCase();
                const layerColor = thisLayer.name.split("_")[0].toUpperCase();
                const sku = thisLayer.comp("DATA-Twin").layer("SKU").text.sourceText.toUpperCase();
                const isMultipack = sku.split("-").pop().includes("P");

                var result = isMultipack && data.variantsMultipack?.[variant]?.[layerColor]
                    ? data.variantsMultipack[variant][layerColor]
                    : data.variants[variant][layerColor];
                
                return thisLayer.hexToRgb(result);
            } else {
                return thisLayer.hexToRgb("FFFFFF");
            }
        } catch (e) {
            return thisLayer.hexToRgb("FFFFFF");
        }
    },
    "shadowTint": function() { //returns 0-100 tint amount for the shadow fro mthe JSON... since some shadows need to be tinted more...
        const lib = thisLayer.footage("expressionLibrary.jsx").sourceData;
        const data = thisLayer.footage("labelColors.json").sourceData;
        const variant = lib.actualVariant().toUpperCase();
        const shadowTint = data.variants[variant]?.shadowTint || 50;
        return shadowTint;
    },
    "rbFont": function(textData, textType) { // Applies the correct alphabet font for each character in the text
        thisLayer.posterizeTime(0);
        // Access JSON footage data
        const countryData = thisLayer.footage("countryData.json").sourceData;
        var textStyle = thisLayer.text.sourceText.style;
        
        // Set the text content first
        textStyle.text = textData;

        let fonts = getFonts(textType); // Either headline or subline depending on what text needs

        // Return font for either headline or subline
        function getFonts(textType) {
            let fonts;
            if (textType === "headline") {
                fonts = countryData.aeFonts.headlineFonts || {};
            } else if (textType === "subline") {
                fonts = countryData.aeFonts.sublineFonts || {};
            } else if (textType === "claim") {
                fonts = countryData.aeFonts.claimFonts || {};
            }
            fonts.Latin = fonts.Latin || "FuturaforRedBull-CondBold";
            return fonts;
        }

        // Function to detect script based on Unicode code point
        function getScript(code) {
            // Korean Hangul (Jamo, Compatibility Jamo, Syllables, Extended)
            if ((code >= 0x1100 && code <= 0x11FF) || // Hangul Jamo
                (code >= 0x3130 && code <= 0x318F) || // Hangul Compatibility Jamo
                (code >= 0xAC00 && code <= 0xD7AF) || // Hangul Syllables
                (code >= 0xA960 && code <= 0xA97F) || // Hangul Jamo Extended-A
                (code >= 0xD7B0 && code <= 0xD7FF)) { // Hangul Jamo Extended-B
                return "Korean";
            }

            // Japanese (Hiragana, Katakana, Fullwidth, CJK punctuation)
            if ((code >= 0x3040 && code <= 0x30FF) || // Hiragana & Katakana
                (code >= 0xFF00 && code <= 0xFFEF) || // Fullwidth Forms
                (code >= 0x3000 && code <= 0x303F)) { // CJK Symbols & Punctuation
                return "Japanese";
            }

            // CJK Unified Ideographs (mostly Chinese, also used in JP/KR)
            if ((code >= 0x4E00 && code <= 0x9FFF) || 
                (code >= 0x3400 && code <= 0x4DBF)) {
                return "Chinese"; // Default to CJK (Chinese Hanzi)
            }

            // Other major scripts
            if (code >= 0x0000 && code <= 0x02FF) return "Latin";
            if (code >= 0x0600 && code <= 0x06FF) return "Arabic";
            if (code >= 0x0E00 && code <= 0x0E7F) return "Thai";
            if (code >= 0x10A0 && code <= 0x10FF) return "Georgian";
            if (code >= 0x0530 && code <= 0x058F) return "Armenian";
            if (code >= 0x0370 && code <= 0x03FF) return "Greek";
            if (code >= 0x0590 && code <= 0x05FF) return "Hebrew";

            // Fallback
            return "Fallback";
        }



        // Loop through text and apply fonts to consecutive ranges of the same script
        let i = 0;
        while (i < textData.length) {
            let code = textData.charCodeAt(i);
            let script = getScript(code);
            let start = i;
            i++;
            while (i < textData.length && getScript(textData.charCodeAt(i)) === script) {
                i++;
            }
            let length = i - start;
            textStyle = textStyle.setFont(fonts[script], start, length).setText(textData);
        }
        return textStyle; // Return the styled text object
    }
}