let cellSize, noiseZoom, zOff = 0;
let noiseImg, needsUpdate = true;
let seedOffsetX = 0, seedOffsetY = 0;

// Initializes canvas, loads settings, and sets up UI listeners
function setup() {
    createCanvas(windowWidth, windowHeight);
    noSmooth(); 
    loadSettings();

    document.querySelectorAll("input").forEach((input) => {
        input.addEventListener("input", (e) => {
            updateUIValues();
            if (e.target.id === 'autoUpdate') toggleAutoUpdate();
            if (document.getElementById("autoUpdate").checked) needsUpdate = true;
        });
    });

    updateUIValues();
    toggleAutoUpdate(); 
    createGridImage();
}

// Toggles visual state of render button
function toggleAutoUpdate() {
    let isAuto = document.getElementById("autoUpdate").checked;
    document.getElementById("btnRender").style.display = isAuto ? "none" : "block";
    if (isAuto) needsUpdate = true;
}

function forceRender() { needsUpdate = true; }

function randomizeSeed() {
    seedOffsetX = Math.random() * 10000; seedOffsetY = Math.random() * 10000;
    if (document.getElementById("autoUpdate").checked) needsUpdate = true;
}

// Allocates appropriately-sized Float32 buffers based on current window/cell size
function createGridImage() {
    let cols = Math.ceil(width / cellSize), rows = Math.ceil(height / cellSize);
    noiseImg = createImage(cols, rows);
    let totalPixels = cols * rows;
    
    heightMap = new Float32Array(totalPixels); 
    shadowMap = new Float32Array(totalPixels);
    blurTempMap = new Float32Array(totalPixels);
    
    updateNoiseScale(cols, rows);
    if(document.getElementById("autoUpdate").checked) needsUpdate = true;
}

// Syncs DOM UI labels with internal input values
function updateUIValues() {
    cellSize = parseInt(document.getElementById("cellSize").value);
    noiseZoom = parseFloat(document.getElementById("noiseZoom").value);

    const ids = ["cellSize", "noiseZoom", "elevation", "contrast", "sunAngle", "sunHeight", "shadowDarkness", "shadowBlur", "shadowBias", "diffuseSmooth"];
    ids.forEach(id => document.getElementById(`v-${id}`).innerText = document.getElementById(id).value + (id === 'sunAngle' ? '°' : id === 'cellSize' ? 'px' : ''));

    const biomes = ["deepWater", "shallowWater", "sand", "grass", "forest", "rock"];
    biomes.forEach(id => document.getElementById(`v-${id}`).innerText = Math.round(document.getElementById(id).value * 100) + "%");

    buildColorLUT();
    if (noiseImg && (Math.ceil(width / cellSize) !== noiseImg.width || Math.ceil(height / cellSize) !== noiseImg.height)) createGridImage();
}

// P5 loop handles scheduled updates and continuous animation flags
function draw() {
    if (document.getElementById("autoUpdate").checked) {
        if (document.getElementById("animate").checked) { zOff += 0.015; needsUpdate = true; }
        if (document.getElementById("orbitSun").checked) {
            let sSlider = document.getElementById("sunAngle");
            sSlider.value = (parseFloat(sSlider.value) + 1) % 360;
            document.getElementById("v-sunAngle").innerText = Math.round(sSlider.value) + "°";
            needsUpdate = true;
        }
    }
    if (needsUpdate) { generateTerrain(); needsUpdate = false; }
    image(noiseImg, 0, 0, noiseImg.width * cellSize, noiseImg.height * cellSize);
}

function windowResized() { resizeCanvas(windowWidth, windowHeight); createGridImage(); }

// Persists configurations to browser memory
function saveSettings() {
    let settings = { seedOffsetX, seedOffsetY };
    document.querySelectorAll("#ui input").forEach(el => settings[el.id] = el.type === "checkbox" ? el.checked : el.value);
    localStorage.setItem("fastTerrainSettings2", JSON.stringify(settings));

    let btn = document.getElementById("saveBtn");
    btn.innerText = "Saved ✓"; btn.style.background = "#2E7D32";
    setTimeout(() => { btn.innerText = "Save Settings"; btn.style.background = "#4CAF50"; }, 1000);
}

// Retrieves configuration variables
function loadSettings() {
    let saved = localStorage.getItem("fastTerrainSettings2");
    if (saved) {
        let s = JSON.parse(saved);
        seedOffsetX = s.seedOffsetX || 0; seedOffsetY = s.seedOffsetY || 0;
        for (let key in s) {
            let el = document.getElementById(key);
            if (el) el.type === "checkbox" ? el.checked = s[key] : el.value = s[key];
        }
    }
}

function resetSettings() { localStorage.removeItem("fastTerrainSettings2"); location.reload(); }