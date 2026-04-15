# Advanced Fast Terrain Generator

A high-performance, browser-based procedural terrain and city generator built with JavaScript and p5.js. 

## Features

* **Procedural Terrain:** Fast noise-based heightmap generation with adjustable scale, contrast, and global elevation.
* **Dynamic 3D Lighting:** Real-time raytraced shadows with adjustable sun angle, elevation, darkness, and diffuse smoothing.
* **Biome Mapping:** Fully customizable height-based biomes (Deep Water, Shallow Water, Sand, Grass, Forest, Rock) with smooth or hard gradient transitions.
* **Hydraulic Erosion & Weathering:** Physically-based rain droplet simulation that erodes slopes and deposits sediment, alongside thermal settling (smoothing) for realistic landscapes.
* **Procedural Cities:** Generates organic, irregularly shaped towns with dense centers and sparse outskirts. Automatically flattens the 3D terrain underneath buildings and streets.
* **Intelligent Pathfinding:** Connects cities using an A* algorithm that naturally avoids steep mountains and water, creating pixel-perfect roads that blend into the terrain and catch 3D shadows.
* **Interactive Editor:** Right-click region selection to manually override terrain heights or isolate erosion simulations.
* **Import / Export:** Download your generated terrain as a PNG, or upload your own grayscale heightmap images to use as a base.

---

## Instructions

### Getting Started
1. Clone or download the project files (`index.html`, `main.js`, `noise.js`, `render.js`).
2. Open `index.html` in any modern web browser. (No build tools or local servers required).

### Camera Controls
* **Pan:** Left-click or Middle-click and drag the map.
* **Zoom:** Use the mouse scroll wheel.
* **Select Region:** Right-click and drag to draw a red selection box (used for the Region Editor and targeted erosion).

### Recommended Workflow
1. **Shape the Land:** Adjust the *Map Dimensions*, *Noise Settings*, and *Biome Thresholds* until you find a landmass you like. Use the **Randomize Map Seed** button to reroll.
2. **Weather the Terrain:** Under *Hydraulic Erosion*, click **Drops (Random)** or **Drops (Every Pixel)** to carve realistic rivers and mountain valleys into the smooth noise.
3. **Settle the Map:** Under *Town Generation*, adjust the desired size, density, and spacing, then click **Generate Towns**. The terrain will automatically flatten to accommodate the foundations.
4. **Connect the World:** Under *Pathfinding & Roads*, adjust the steepness penalty and road aesthetics (thickness, opacity, curve), then click **Generate Road Network**. 
5. **Tweak Lighting:** Adjust the *Sun Angle* and *Sun Elevation* under the Shadows tab to see how the light interacts with your new cities and mountains.

### Saving & Loading
* **To Save:** Click **Download Map** at the bottom of the menu to save a raw PNG of your generated world. Click **Save Settings** to remember your slider configurations for your next session.
* **To Load:** Click **Upload Map** and select any image file. The generator will automatically convert the image's brightness into 3D terrain data.
