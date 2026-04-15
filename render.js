const N_MIN = 0.56185, N_MAX = 1.3275, N_RANGE = N_MAX - N_MIN;
let heightMap, shadowMap, blurTempMap, overrideMap; 
let lut = new Uint8Array(256 * 3); 

function buildColorLUT() {
    let dw = parseFloat(document.getElementById("deepWater").value);
    let sw = parseFloat(document.getElementById("shallowWater").value);
    let sa = parseFloat(document.getElementById("sand").value);
    let gr = parseFloat(document.getElementById("grass").value);
    let fo = parseFloat(document.getElementById("forest").value);
    let ro = parseFloat(document.getElementById("rock").value);
    let isSmooth = document.getElementById("smoothGradients").checked;

    let c = [[15,60,115],[50,150,200], [220,200,140],[100,160,70], [35,100,45],[130,130,130], [250,255,255]];
    let getFrac = (t, min, max) => max === min ? 0 : (t - min) / (max - min);

    for (let i = 0; i < 256; i++) {
        let t = i / 255, col;
        if (isSmooth) {
            if (t <= dw) col = c[0];
            else if (t <= sw) col = lerpArr(c[0], c[1], getFrac(t, dw, sw));
            else if (t <= sa) col = lerpArr(c[1], c[2], getFrac(t, sw, sa));
            else if (t <= gr) col = lerpArr(c[2], c[3], getFrac(t, sa, gr));
            else if (t <= fo) col = lerpArr(c[3], c[4], getFrac(t, gr, fo));
            else if (t <= ro) col = lerpArr(c[4], c[5], getFrac(t, fo, ro));
            else col = lerpArr(c[5], c[6], getFrac(t, ro, 1.0));
        } else {
            col = t <= dw ? c[0] : t <= sw ? c[1] : t <= sa ? c[2] : t <= gr ? c[3] : t <= fo ? c[4] : t <= ro ? c[5] : c[6];
        }
        lut[i*3] = col[0]; lut[i*3+1] = col[1]; lut[i*3+2] = col[2];
    }
}

function fastBoxBlur(src, dst, temp, w, h, radius) {
    if (radius < 1) { dst.set(src); return; }
    let diam = radius * 2 + 1, invDiam = 1.0 / diam;

    for (let y = 0; y < h; y++) {
        let outIdx = y * w, sum = 0;
        for (let i = -radius; i <= radius; i++) sum += src[outIdx + Math.min(Math.max(i, 0), w - 1)];
        temp[outIdx] = sum * invDiam;
        for (let x = 1; x < w; x++) {
            sum += src[outIdx + Math.min(x + radius, w - 1)] - src[outIdx + Math.max(x - radius - 1, 0)];
            temp[outIdx + x] = sum * invDiam;
        }
    }
    for (let x = 0; x < w; x++) {
        let sum = 0;
        for (let i = -radius; i <= radius; i++) sum += temp[Math.min(Math.max(i, 0), h - 1) * w + x];
        dst[x] = sum * invDiam;
        for (let y = 1; y < h; y++) {
            sum += temp[Math.min(y + radius, h - 1) * w + x] - temp[Math.max(y - radius - 1, 0) * w + x];
            dst[y * w + x] = sum * invDiam;
        }
    }
}

function generateTerrain() {
    noiseImg.loadPixels();
    let cols = noiseImg.width, rows = noiseImg.height;

    let offset = parseFloat(document.getElementById("elevation").value);
    let contrast = parseFloat(document.getElementById("contrast").value);
    let island = document.getElementById("islandify").checked;
    let doShading = document.getElementById("shading").checked;
    let showRoads = document.getElementById("showRoads") && document.getElementById("showRoads").checked;
    
    let sunAngle = parseFloat(document.getElementById("sunAngle").value) * (Math.PI / 180);
    let sunHeight = parseFloat(document.getElementById("sunHeight").value);
    let darkness = parseFloat(document.getElementById("shadowDarkness").value);
    let blurRadius = parseInt(document.getElementById("shadowBlur").value);
    let shadowBias = parseFloat(document.getElementById("shadowBias").value);
    let dSmooth = parseInt(document.getElementById("diffuseSmooth").value);
    let waterShadows = document.getElementById("waterShadows").checked;
    let waterLvl = parseFloat(document.getElementById("shallowWater").value);

    let sX = Math.cos(sunAngle), sY = Math.sin(sunAngle), maxSteps = 40;
    let cx = cols * 0.5, cy = rows * 0.5;
    let invMaxDist = 1.0 / Math.sqrt(cx * cx + cy * cy);
    let pxData = noiseImg.pixels;

    // Load dynamic Road Colors from UI
    let rColorHex = document.getElementById("roadColor") ? document.getElementById("roadColor").value : "#696969";
    let rR = parseInt(rColorHex.substring(1,3), 16);
    let rG = parseInt(rColorHex.substring(3,5), 16);
    let rB = parseInt(rColorHex.substring(5,7), 16);
    let rOpac = document.getElementById("roadOpacity") ? parseFloat(document.getElementById("roadOpacity").value) : 0.6;
    let invOpac = 1.0 - rOpac;

    // PASS 1: Base Height Map Generation 
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            let idx = x + y * cols;
            let val = (getNoiseFast((x + seedOffsetX) * noiseZoom, (y + seedOffsetY) * noiseZoom, zOff) - N_MIN) / N_RANGE;
            
            if (island) {
                let dx = x - cx, dy = y - cy;
                let falloff = 1.0 - (Math.sqrt(dx * dx + dy * dy) * invMaxDist);
                val *= falloff * falloff;     
            }
            val = (val - 0.5) * contrast + 0.5 + offset;

            if (overrideMap && overrideMap[idx] > -500) {
                val = overrideMap[idx];
            }
            if (typeof townHeightMap !== 'undefined' && townHeightMap[idx] > -500) {
                val = townHeightMap[idx];
            }
            
            val = val < 0 ? 0 : (val > 1 ? 1 : val);
            heightMap[idx] = val;
        }
    }

    // PASS 2: Raytraced Hard Shadows
    shadowMap.fill(1.0);
    if (doShading) {
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let idx = x + y * cols, h = heightMap[idx];
                if (h <= waterLvl && !waterShadows) continue;

                let rayX = x, rayY = y, rayZ = h + shadowBias; 
                for (let step = 1; step <= maxSteps; step++) {
                    rayX += sX; rayY += sY; rayZ += sunHeight;
                    let rx = rayX | 0, ry = rayY | 0; 
                    if (rx < 0 || rx >= cols || ry < 0 || ry >= rows) break;
                    if (heightMap[rx + ry * cols] > rayZ) { shadowMap[idx] = darkness; break; }
                }
            }
        }
        // PASS 3: Soft Shadows via sliding window Box Blur
        fastBoxBlur(shadowMap, shadowMap, blurTempMap, cols, rows, blurRadius);
    }

    // PASS 4: Final Compositing
    for (let y = 0; y < rows; y++) {
        let yOffset = y * cols;
        for (let x = 0; x < cols; x++) {
            let i = x + yOffset, h = heightMap[i];
            let idx = (h * 255) | 0;
            idx = idx < 0 ? 0 : (idx > 255 ? 255 : idx);

            let r = lut[idx*3], g = lut[idx*3+1], b = lut[idx*3+2];

            // ROADS COMPOSITING PASS (Runs BEFORE shadows so the road darkens properly in mountain shade)
            if (showRoads && typeof roadMap !== 'undefined' && roadMap[i] > 0) {
                let trR = rR, trG = rG, trB = rB;
                
                // Town interior roads are rendered slightly brighter to remain visually distinct
                if (roadMap[i] === 1) { 
                    trR = Math.min(255, rR + 25);
                    trG = Math.min(255, rG + 25);
                    trB = Math.min(255, rB + 25);
                }
                
                // Alpha blend custom road color with the underlying biome pixels
                r = (r * invOpac) + (trR * rOpac);
                g = (g * invOpac) + (trG * rOpac);
                b = (b * invOpac) + (trB * rOpac);
            }

            // SHADOW COMPOSITING PASS
            if (doShading) {
                if (h > waterLvl) {
                    let hL = x >= dSmooth ? heightMap[i - dSmooth] : h;
                    let hT = y >= dSmooth ? heightMap[i - dSmooth * cols] : h;
                    hL = hL <= waterLvl ? h : hL; hT = hT <= waterLvl ? h : hT;

                    let diffuse = 1.0 - ((h - hL) * sX + (h - hT) * sY) * (30.0 / dSmooth); 
                    diffuse = diffuse > 1.3 ? 1.3 : (diffuse < 0.8 ? 0.8 : diffuse);

                    let finalLight = diffuse * shadowMap[i];
                    r *= finalLight; g *= finalLight; b *= finalLight;
                } else if (waterShadows) {
                    let waterShadow = 1.0 + (shadowMap[i] - 1.0) * 0.6; 
                    r *= waterShadow; g *= waterShadow; b *= waterShadow;
                }
            }

            let pIdx = i << 2; 
            pxData[pIdx] = r; pxData[pIdx + 1] = g; pxData[pIdx + 2] = b; pxData[pIdx + 3] = 255;
        }
    }
    noiseImg.updatePixels();
}

function lerpArr(c1, c2, amt) {
    amt = amt < 0 ? 0 : (amt > 1 ? 1 : amt);
    return[ c1[0] + (c2[0] - c1[0]) * amt, c1[1] + (c2[1] - c1[1]) * amt, c1[2] + (c2[2] - c1[2]) * amt ];
}