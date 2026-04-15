// Pre-compute angles/trigonometry so they aren't calculated millions of times per frame
const TWO_PI = Math.PI * 2;
const C0 = Math.cos(1.3 * TWO_PI), S0 = Math.sin(1.3 * TWO_PI);
const C1 = Math.cos(0.39 * TWO_PI), S1 = Math.sin(0.39 * TWO_PI);
const C2 = Math.cos(0.19 * TWO_PI), S2 = Math.sin(0.19 * TWO_PI);
const C3 = Math.cos(0.99 * TWO_PI), S3 = Math.sin(0.99 * TWO_PI);
const C4 = Math.cos(0.29 * TWO_PI), S4 = Math.sin(0.29 * TWO_PI);
const C5 = Math.cos(0.49 * TWO_PI), S5 = Math.sin(0.49 * TWO_PI);
const C6 = Math.cos(0.65 * TWO_PI), S6 = Math.sin(0.65 * TWO_PI);

let globalNoiseScale = 1;

// Updates the internal map scale based on grid bounds
function updateNoiseScale(w, h) {
    globalNoiseScale = Math.max(w, h) / 300;
}

// Inlined vector rotations and math for maximum CPU performance
function getNoiseFast(x, y, z = 0) {
    x /= globalNoiseScale; 
    y /= globalNoiseScale;
    
    x = (x + 2139) / 40; 
    y = (y + 2319) / 40; 
    z = (z + 12492) / 40;
    
    let tx, ty, r = 0;

    // Octave 0
    tx = x - 2103; ty = y - 4056;
    x = tx * C0 - ty * S0 + 2103;
    y = tx * S0 + ty * C0 + 4056;
    r += noise(x, y, z);

    // Octave 1
    tx = x - 2103; ty = y - 4056;
    x = tx * C1 - ty * S1 + 2103;
    y = tx * S1 + ty * C1 + 4056;
    x *= 2; y *= 2; z *= 124; // Original logic: z *= 2 + 122 -> z *= 124
    r += noise(x, y, z) * 0.5;

    // Octave 2
    tx = x - 2103; ty = y - 4056;
    x = tx * C2 - ty * S2 + 2103;
    y = tx * S2 + ty * C2 + 4056;
    x *= 2; y *= 2; z *= 1224; // Original logic: z *= 2 + 1222 -> z *= 1224
    r += noise(x, y, z) * 0.25;

    // Octave 3 - Note different cy (40356)
    tx = x - 2103; ty = y - 40356;
    x = tx * C3 - ty * S3 + 2103;
    y = tx * S3 + ty * C3 + 40356;
    x *= 2; y *= 2; z *= 122124; // Original logic: z *= 2 + 122122 -> z *= 122124
    r += noise(x, y, z) * 0.125;

    // Octave 4 - Note different cx (21103)
    tx = x - 21103; ty = y - 4056;
    x = tx * C4 - ty * S4 + 21103;
    y = tx * S4 + ty * C4 + 4056;
    x *= 2; y *= 2; z *= 122123; // Original logic: z *= 2 + 122121 -> z *= 122123
    r += noise(x, y, z) * 0.0625;

    // Octave 5 - Note different cy (40856)
    tx = x - 2103; ty = y - 40856;
    x = tx * C5 - ty * S5 + 2103;
    y = tx * S5 + ty * C5 + 40856;
    x *= 2; y *= 2; z *= 122123; // Original logic: z *= 2 + 122121 -> z *= 122123
    r += noise(x, y, z) * 0.03125;

    // Octave 6 - Note different cx (21003)
    tx = x - 21003; ty = y - 4056;
    x = tx * C6 - ty * S6 + 21003;
    y = tx * S6 + ty * C6 + 4056;
    x *= 2; y *= 2; z *= 1226; // Original logic: z *= 2 + 1224 -> z *= 1226
    r += noise(x, y, z) * 0.015625;

    return r;
}