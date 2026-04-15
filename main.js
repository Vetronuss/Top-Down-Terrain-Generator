let cellSize, noiseZoom, zOff = 0;
let noiseImg, needsUpdate = true;
let seedOffsetX = 0, seedOffsetY = 0;
let mapWidth = 2000, mapHeight = 2000;

let panX = 0, panY = 0, zoom = 1;
let isSelecting = false, hasSelection = false, isPanning = false, isEroding = false;
let selStartX = 0, selStartY = 0, selEndX = 0, selEndY = 0;

let towns = [];
let roads = [];
let isPathfinding = false;

let gScoreMap, fScoreMap, cameFromMap, townHeightMap, roadMap;

function simplifyPath(path) {
	if (!path || path.length <= 2) return path;

	let simplified = [path[0]];

	for (let i = 1; i < path.length - 1; i++) {
		let pPrev = simplified[simplified.length - 1]; 
		let pCurr = path[i];
		let pNext = path[i + 1];

		let dx1 = pCurr.x - pPrev.x;
		let dy1 = pCurr.y - pPrev.y;
		let dx2 = pNext.x - pCurr.x;
		let dy2 = pNext.y - pCurr.y;

		if ((dx1 * dy2 - dy1 * dx2) !== 0) {
			simplified.push(pCurr);
		}
	}
	simplified.push(path[path.length - 1]);
	return simplified;
}

class Town {
	constructor(x, y, size) {
		this.x = x;
		this.y = y;
		this.size = size;
		let icons = ["🏠", "🏰", "🛖", "⛺"];
		this.icon = icons[Math.floor(Math.random() * icons.length)];
		this.irreg = parseFloat(document.getElementById("townIrregularity").value);
		this.angle = Math.random() * Math.PI;
		this.stretch = 1.0 - (Math.random() * 0.7 * this.irreg); 

		this.buildings = [];
		this.localRoadCells = [];
		this.generateCityLayout();
	}

	isInside(worldX, worldY) {
		let dx = worldX - this.x;
		let dy = worldY - this.y;

		let rx = dx * Math.cos(this.angle) - dy * Math.sin(this.angle);
		let ry = dx * Math.sin(this.angle) + dy * Math.cos(this.angle);

		rx *= 1.0 / this.stretch;
		let r = Math.sqrt(rx * rx + ry * ry);
		
		let n = noise(worldX * 0.08, worldY * 0.08);
		let baseRadius = this.size;
		let noiseRadius = this.size * (0.4 + 1.2 * n); 
		let finalRadius = (baseRadius * (1.0 - this.irreg)) + (noiseRadius * this.irreg);
		
		return r <= finalRadius;
	}

	generateCityLayout() {
		let spacing = parseInt(document.getElementById("buildingSpacing").value);
		let decline = parseFloat(document.getElementById("densityDecline").value);

		let blockSize = Math.max(3, Math.floor(this.size / 4));
		let maxRadius = Math.ceil(this.size * 1.6); 
		let bounds = maxRadius * 2 + 1;
		let grid = Array(bounds).fill(0).map(() => Array(bounds).fill(0));

		let cols = noiseImg.width;
		let waterLvl = parseFloat(document.getElementById("shallowWater").value) + 
					  (parseFloat(document.getElementById("shallowWaterBais").value) * 0.01);
		
		let getH = (wx, wy) => {
			let idx = wx + wy * cols;
			return overrideMap && overrideMap[idx] > -500 ? overrideMap[idx] : heightMap[idx];
		};

		for(let y = -maxRadius; y <= maxRadius; y++) {
			for(let x = -maxRadius; x <= maxRadius; x++) {
				let wx = this.x + x;
				let wy = this.y + y;
				if(!this.isInside(wx, wy)) continue;
				if(getH(wx, wy) <= waterLvl) continue; 
				
				let gx = x + maxRadius;
				let gy = y + maxRadius;
				let isStreet = false;

				if (x === 0 || y === 0) isStreet = true;
				else if (Math.abs(x) % blockSize === 0 && Math.random() < 0.8) isStreet = true;
				else if (Math.abs(y) % blockSize === 0 && Math.random() < 0.8) isStreet = true;

				if (isStreet) {
					grid[gy][gx] = 1; 
					this.localRoadCells.push({x: wx, y: wy});
				}
			}
		}

		let colors = ['#8B4513', '#A0522D', '#CD853F', '#696969', '#808080', '#555555', '#4A4A4A', '#D2B48C'];
		let roofTypes = ['flat', 'gabled_v', 'gabled_h', 'pyramid'];

		for(let y = -maxRadius; y <= maxRadius; y++) {
			for(let x = -maxRadius; x <= maxRadius; x++) {
				let gx = x + maxRadius;
				let gy = y + maxRadius;
				
				if (gx < 0 || gx >= bounds || gy < 0 || gy >= bounds) continue;
				if (!this.isInside(this.x + x, this.y + y)) continue;
				if (grid[gy][gx] !== 0) continue; 

				let distToCenter = Math.sqrt(x*x + y*y) / maxRadius;
				let spawnChance = 1.0 - (distToCenter * decline);
				if (Math.random() > spawnChance) continue;

				let nearRoad = false;
				if (gy > 0 && grid[gy-1][gx] === 1) nearRoad = true;
				if (gy < bounds-1 && grid[gy+1][gx] === 1) nearRoad = true;
				if (gx > 0 && grid[gy][gx-1] === 1) nearRoad = true;
				if (gx < bounds-1 && grid[gy][gx+1] === 1) nearRoad = true;

				if (nearRoad) {
					let bw = Math.floor(Math.random() * 3) + 1;
					let bh = Math.floor(Math.random() * 3) + 1;

					let canFit = true;
					for(let by = -spacing; by < bh + spacing; by++) {
						for(let bx = -spacing; bx < bw + spacing; bx++) {
							let ngx = gx + bx;
							let ngy = gy + by;
							let isInsideFootprint = (bx >= 0 && bx < bw && by >= 0 && by < bh);
							
							if (ngx < 0 || ngy < 0 || ngx >= bounds || ngy >= bounds) {
								if (isInsideFootprint) canFit = false; 
								continue; 
							}

							if (isInsideFootprint) {
								let wx = this.x + x + bx;
								let wy = this.y + y + by;
								if (!this.isInside(wx, wy)) { canFit = false; break; }
								if (getH(wx, wy) <= waterLvl) { canFit = false; break; } 
								if (grid[ngy][ngx] !== 0) { canFit = false; break; }
							} else {
								if (grid[ngy][ngx] === 2) { canFit = false; break; }
							}
						}
						if (!canFit) break;
					}

					if (canFit) {
						for(let by = 0; by < bh; by++) {
							for(let bx = 0; bx < bw; bx++) {
								grid[gy+by][gx+bx] = 2; 
							}
						}
						this.buildings.push({
							x: this.x + x,
							y: this.y + y,
							w: bw,
							h: bh,
							color: colors[Math.floor(Math.random() * colors.length)],
							roof: roofTypes[Math.floor(Math.random() * roofTypes.length)]
						});
					}
				}
			}
		}
	}

	applyFlattening() {
        if (!document.getElementById("flatten").checked) return;
		
		let cols = noiseImg.width;
		let sumH = 0, count = 0;
		let cellWeights = new Map(); 

		let addCell = (cx, cy, weight) => {
			let id = cx + "," + cy;
			let currentW = cellWeights.get(id) || 0;
			if (weight > currentW) cellWeights.set(id, weight); 
		};

		let pad = 5; 
		for (let rc of this.localRoadCells) {
			for (let py = -pad; py <= pad; py++) {
				for (let px = -pad; px <= pad; px++) {
					let dist = Math.sqrt(px*px + py*py);
					if (dist <= pad) {
						let w = Math.max(0, 1.0 - (dist / (pad + 1))); 
						addCell(rc.x + px, rc.y + py, w);
					}
				}
			}
		}
		for (let b of this.buildings) {
			for (let by = -pad; by < b.h + pad; by++) {
				for (let bx = -pad; bx < b.w + pad; bx++) {
					let dX = Math.max(0, -bx, bx - (b.w - 1));
					let dY = Math.max(0, -by, by - (b.h - 1));
					let dist = Math.sqrt(dX*dX + dY*dY);
					
					if (dist <= pad) {
						let w = Math.max(0, 1.0 - (dist / (pad + 1))); 
						addCell(b.x + bx, b.y + by, w);
					}
				}
			}
		}

		for (let [id, w] of cellWeights.entries()) {
			if (w === 1.0) {
				let parts = id.split(",");
				let cx = parseInt(parts[0]);
				let cy = parseInt(parts[1]);
				let idx = cx + cy * cols;
				if (idx >= 0 && idx < overrideMap.length) {
					let h = townHeightMap[idx] > -500 ? townHeightMap[idx] : (overrideMap[idx] > -500 ? overrideMap[idx] : heightMap[idx]);
					sumH += h;
					count++;
				}
			}
		}

		if (count === 0) return;
		let avgH = sumH / count;

		for (let [id, w] of cellWeights.entries()) {
			let parts = id.split(",");
			let cx = parseInt(parts[0]);
			let cy = parseInt(parts[1]);
			let idx = cx + cy * cols;
			
			if (idx >= 0 && idx < overrideMap.length) {
				let h = townHeightMap[idx] > -500 ? townHeightMap[idx] : (overrideMap[idx] > -500 ? overrideMap[idx] : heightMap[idx]);
				let blend = 0.85 * w; 
				townHeightMap[idx] = h * (1 - blend) + avgH * blend;
			}
		}
	}
}

class MinHeap {
	constructor() { this.heap = []; }
	push(val, score) { this.heap.push({ val, score }); this.bubbleUp(this.heap.length - 1); }
	pop() {
		if (this.heap.length === 1) return this.heap.pop().val;
		const top = this.heap[0].val;
		this.heap[0] = this.heap.pop();
		this.sinkDown(0);
		return top;
	}
	isEmpty() { return this.heap.length === 0; }
	bubbleUp(idx) {
		while (idx > 0) {
			let pIdx = Math.floor((idx - 1) / 2);
			if (this.heap[idx].score >= this.heap[pIdx].score) break;
			let tmp = this.heap[idx];
			this.heap[idx] = this.heap[pIdx];
			this.heap[pIdx] = tmp;
			idx = pIdx;
		}
	}
	sinkDown(idx) {
		let length = this.heap.length;
		while (true) {
			let left = 2 * idx + 1, right = 2 * idx + 2, swap = null;
			if (left < length && this.heap[left].score < this.heap[idx].score) swap = left;
			if (right < length) {
				let comp = swap === null ? idx : swap;
				if (this.heap[right].score < this.heap[comp].score) swap = right;
			}
			if (swap === null) break;
			let tmp = this.heap[idx];
			this.heap[idx] = this.heap[swap];
			this.heap[swap] = tmp;
			idx = swap;
		}
	}
}

let cnv;
function setup() {
	cnv = createCanvas(windowWidth, windowHeight);
	const ctx = cnv.elt.getContext("2d", { willReadFrequently: true });
	drawingContext = ctx;
	noSmooth();
	loadSettings();

	mapWidth = parseInt(document.getElementById("mapWidth").value) || 2000;
	mapHeight = parseInt(document.getElementById("mapHeight").value) || 2000;
	panX = (width - mapWidth) / 2;
	panY = (height - mapHeight) / 2;

	document.querySelector("canvas").addEventListener("contextmenu", (e) => e.preventDefault());

	document.querySelectorAll("input, select").forEach((input) => {
		input.addEventListener("input", (e) => {
			updateUIValues();
			if (e.target.id === "autoUpdate") toggleAutoUpdate();
			
            // Instantly re-rasterize roads to map if specific road visuals are changed
            if (["roadThickness", "curveRoads", "roadStep"].includes(e.target.id)) {
                if (roads.length > 0) {
                    rasterizeRoadsToMap();
                    needsUpdate = true; // Force map composite to run to show changes immediately
                }
            }
            if (e.target.id === "roadColor" || e.target.id === "roadOpacity") {
                needsUpdate = true;
            }

			if (document.getElementById("autoUpdate") && document.getElementById("autoUpdate").checked) needsUpdate = true;
		});
	});

	updateUIValues();
	toggleAutoUpdate();
	createGridImage();
}

function mousePressed(event) {
	if (event && event.target && event.target.tagName !== "CANVAS") return;
	if (mouseButton === LEFT || mouseButton === CENTER) isPanning = true;
	else if (mouseButton === RIGHT) {
		isSelecting = true;
		hasSelection = true;
		selStartX = (mouseX - panX) / zoom;
		selStartY = (mouseY - panY) / zoom;
		selEndX = selStartX;
		selEndY = selStartY;
	}
}
function mouseDragged(event) {
	if (isPanning) {
		panX += mouseX - pmouseX;
		panY += mouseY - pmouseY;
	} else if (isSelecting) {
		selEndX = (mouseX - panX) / zoom;
		selEndY = (mouseY - panY) / zoom;
	}
}
function mouseReleased() {
	isPanning = false;
	isSelecting = false;
	if (Math.abs(selEndX - selStartX) < 2 && Math.abs(selEndY - selStartY) < 2)
		hasSelection = false;
}
function mouseWheel(event) {
	if (event && event.target && event.target.tagName !== "CANVAS") return;
	let zoomFactor = event.delta > 0 ? 1 / 1.1 : 1.1;
	let prevZoom = zoom;
	zoom = Math.max(0.05, Math.min(zoom * zoomFactor, 50));
	zoomFactor = zoom / prevZoom;
	panX = mouseX - (mouseX - panX) * zoomFactor;
	panY = mouseY - (mouseY - panY) * zoomFactor;
	return false;
}

function updateMapSize() {
	mapWidth = parseInt(document.getElementById("mapWidth").value) || 2000;
	mapHeight = parseInt(document.getElementById("mapHeight").value) || 2000;
	panX = (width - mapWidth) / 2;
	panY = (height - mapHeight) / 2;
	zoom = 1;
	towns = []; 
	createGridImage();
}

function toggleAutoUpdate() {
	let isAuto = document.getElementById("autoUpdate").checked;
	document.getElementById("btnRender").style.display = isAuto ? "none" : "block";
	if (isAuto) needsUpdate = true;
}

function forceRender() {
	needsUpdate = true;
}

function randomizeSeed() {
	seedOffsetX = Math.random() * 10000;
	seedOffsetY = Math.random() * 10000;
	towns = []; 
	if (document.getElementById("autoUpdate").checked) needsUpdate = true;
}

function generateTowns() {
	if (!heightMap) return;

	townHeightMap.fill(-999);
	roadMap.fill(0);

	towns = []; 
	roads = [];
	
	let count = parseInt(document.getElementById("townCount").value);
	let minSpacing = parseInt(document.getElementById("townSpacing").value);
	let minSize = parseInt(document.getElementById("townSizeMin").value);
	let maxSize = parseInt(document.getElementById("townSizeMax").value);
	let maxSlope = parseFloat(document.getElementById("townMaxSlope").value);
	
	let waterLvl = parseFloat(document.getElementById("shallowWater").value);
	let bias = parseFloat(document.getElementById("shallowWaterBais").value) * 0.01;
	waterLvl = Math.min(1, Math.max(0, waterLvl + bias));

	let cols = noiseImg.width, rows = noiseImg.height;
	let maxAttempts = count * 100; 
	let attempts = 0;

	let getH = (x, y) => {
		let idx = x + y * cols;
		return overrideMap && overrideMap[idx] > -500 ? overrideMap[idx] : heightMap[idx];
	};

	while (towns.length < count && attempts < maxAttempts) {
		attempts++;

		let tx = Math.floor(Math.random() * cols);
		let ty = Math.floor(Math.random() * rows);
		
		let baseSize = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
		let checkRadius = Math.ceil(baseSize * 1.6); 

		if (tx - checkRadius < 0 || tx + checkRadius >= cols || ty - checkRadius < 0 || ty + checkRadius >= rows) continue;

		let tooClose = false;
		for (let t of towns) {
			let dist = Math.sqrt((t.x - tx) ** 2 + (t.y - ty) ** 2);
			if (dist < minSpacing) { tooClose = true; break; }
		}
		if (tooClose) continue;

		let centerH = getH(tx, ty);
		if (centerH <= waterLvl) continue;

		let minH = Infinity, maxH = -Infinity;
		let landCount = 0;

		for (let y = ty - checkRadius; y <= ty + checkRadius; y++) {
			for (let x = tx - checkRadius; x <= tx + checkRadius; x++) {
				if (Math.sqrt((x - tx) ** 2 + (y - ty) ** 2) > checkRadius) continue;
				let h = getH(x, y);
				if (h > waterLvl) {
					if (h < minH) minH = h;
					if (h > maxH) maxH = h;
					landCount++;
				}
			}
		}

		if (maxH - minH > maxSlope) continue; 
		if (landCount < baseSize * baseSize * 0.5) continue; 

		let newTown = new Town(tx, ty, baseSize);
		newTown.applyFlattening(); 
		towns.push(newTown);

		for (let rc of newTown.localRoadCells) {
			if (rc.x >= 0 && rc.x < cols && rc.y >= 0 && rc.y < rows) {
				roadMap[rc.x + rc.y * cols] = 1; 
			}
		}
	}
	
	console.log(`Generated ${towns.length} out of ${count} requested towns.`);
	forceRender(); 
}

function rasterizeRoadsToMap() {
	let cols = noiseImg.width, rows = noiseImg.height;
	let pg = createGraphics(cols, rows);
	pg.pixelDensity(1);
	pg.background(0);
	pg.stroke(255);
	pg.noFill();

	let step = parseInt(document.getElementById("roadStep").value) || 1;
	let thick = parseFloat(document.getElementById("roadThickness").value) || 1;
	let isCurve = document.getElementById("curveRoads").checked;
	
	pg.strokeWeight(thick); 
	pg.strokeJoin(ROUND);
	pg.strokeCap(ROUND);
    pg.curveTightness(1)

	for (let path of roads) {
		pg.beginShape();
		if (isCurve) pg.curveVertex(path[0].x, path[0].y); 

		for (let i = 0; i < path.length; i += step) {
			let p = path[i];
			if (isCurve) pg.curveVertex(p.x, p.y);
			else pg.vertex(p.x, p.y);
		}

		let last = path[path.length - 1];
		if (isCurve) {
			pg.curveVertex(last.x, last.y);
			pg.curveVertex(last.x, last.y); 
		} else {
			pg.vertex(last.x, last.y);
		}
		pg.endShape();
	}

	pg.loadPixels();
	let totalPixels = cols * rows;
	for(let i = 0; i < totalPixels; i++) {
		if (roadMap[i] === 2) roadMap[i] = 0; 
		if (pg.pixels[i * 4] > 128) {
			roadMap[i] = 2; 
		}
	}
	pg.remove();
}

async function generateRoads() {
	if (towns.length < 2 || isPathfinding) return;
	isPathfinding = true;
	roads = []; 

	let btn = document.getElementById("btnGenerateRoads");
	let progressCont = document.getElementById("roadProgressContainer");
	let progress = document.getElementById("roadProgress");
	let statusText = document.getElementById("roadStatusText");

	btn.disabled = true;
	progressCont.style.display = "block";

	let connections = getMSTConnections(towns);
	progress.max = connections.length;
	progress.value = 0;

	let penalty = parseFloat(document.getElementById("roadSteepness").value);
	let waterLvl = parseFloat(document.getElementById("shallowWater").value);
	let bias = parseFloat(document.getElementById("shallowWaterBais").value) * 0.01;
	waterLvl = Math.min(1, Math.max(0, waterLvl + bias));

	let successfulRoads = 0;
	for (let i = 0; i < connections.length; i++) {
		let pair = connections[i];
		statusText.innerText = `Routing Path ${i + 1} of ${connections.length}...`;

		let path = await aStarPathfind(pair[0], pair[1], penalty, waterLvl);
		if (path) {
			let startTown = pair[0];
			let endTown = pair[1];
			
			let firstIdx = 0;
			let lastIdx = path.length - 1;
			
			while (firstIdx < path.length) {
				if (startTown.isInside(path[firstIdx].x, path[firstIdx].y)) firstIdx++;
				else break;
			}
			while (lastIdx >= 0) {
				if (endTown.isInside(path[lastIdx].x, path[lastIdx].y)) lastIdx--;
				else break;
			}

			if (firstIdx <= lastIdx) {
				let finalPath = path.slice(firstIdx, lastIdx + 1);
				roads.push(simplifyPath(finalPath));
				successfulRoads++;
			}
		}

		progress.value = i + 1;
		needsUpdate = true;
		await new Promise((r) => setTimeout(r, 0)); 
	}

	rasterizeRoadsToMap();

	statusText.innerText = `Done! Connected ${successfulRoads}/${connections.length} routes.`;
	setTimeout(() => { progressCont.style.display = "none"; }, 2000);

	btn.disabled = false;
	isPathfinding = false;
	forceRender();
}

function getMSTConnections(nodes) {
	let edges = [];
	for (let i = 0; i < nodes.length; i++) {
		for (let j = i + 1; j < nodes.length; j++) {
			let dist = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
			edges.push({ a: i, b: j, d: dist });
		}
	}
	edges.sort((e1, e2) => e1.d - e2.d); 

	let parent = Array(nodes.length).fill(0).map((_, i) => i);
	function find(i) { return parent[i] === i ? i : (parent[i] = find(parent[i])); }
	function union(i, j) {
		let rI = find(i), rJ = find(j);
		if (rI !== rJ) { parent[rI] = rJ; return true; }
		return false;
	}

	let result = [];
	for (let e of edges) if (union(e.a, e.b)) result.push([nodes[e.a], nodes[e.b]]);
	return result;
}

async function aStarPathfind(startNode, endNode, steepnessPenalty, waterLvl) {
	let cols = noiseImg.width, rows = noiseImg.height;
	let startIdx = startNode.x + startNode.y * cols;
	let endIdx = endNode.x + endNode.y * cols;

	gScoreMap.fill(Infinity);
	fScoreMap.fill(Infinity);
	cameFromMap.fill(-1);

	let getH = (idx) => overrideMap && overrideMap[idx] > -500 ? overrideMap[idx] : heightMap[idx];
	let heuristic = (x1, y1, x2, y2) => Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);

	gScoreMap[startIdx] = 0;
	fScoreMap[startIdx] = heuristic(startNode.x, startNode.y, endNode.x, endNode.y);

	let openSet = new MinHeap();
	openSet.push(startIdx, fScoreMap[startIdx]);

	let iterations = 0;
	const maxIterations = 2500000; 

	while (!openSet.isEmpty()) {
		let currIdx = openSet.pop();

		if (currIdx === endIdx) {
			let path = [];
			let trace = currIdx;
			while (trace !== -1 && trace !== startIdx) {
				path.push({ x: trace % cols, y: Math.floor(trace / cols) });
				trace = cameFromMap[trace];
			}
			path.push({ x: startNode.x, y: startNode.y });
			return path.reverse();
		}

		let cx = currIdx % cols, cy = Math.floor(currIdx / cols), ch = getH(currIdx);

		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				let nx = cx + dx, ny = cy + dy;
				if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;

				let nIdx = nx + ny * cols;
				let nh = getH(nIdx);

				if (nh <= waterLvl) continue; 

				let isDiag = dx !== 0 && dy !== 0;
				let heightDiff = Math.abs(ch - nh);
				let cost = (isDiag ? 1.414 : 1.0) + heightDiff * steepnessPenalty;

				let tentative_g = gScoreMap[currIdx] + cost;

				if (tentative_g < gScoreMap[nIdx]) {
					cameFromMap[nIdx] = currIdx;
					gScoreMap[nIdx] = tentative_g;
					fScoreMap[nIdx] = tentative_g + heuristic(nx, ny, endNode.x, endNode.y);
					openSet.push(nIdx, fScoreMap[nIdx]);
				}
			}
		}

		iterations++;
		if (iterations > maxIterations) return null; 
		if (iterations % 4000 === 0) await new Promise((r) => setTimeout(r, 0));
	}
	return null; 
}

function normalizeTerrain() {
	if (!noiseImg || !overrideMap || !heightMap) return;
	let w = noiseImg.width;
	let h = noiseImg.height;
	let total = w * h;

	if (total === 0 || overrideMap.length !== total || heightMap.length !== total) return;
	let minH = Infinity, maxH = -Infinity;
	let margin = 10; 

	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			let i = x + y * w;
			if (overrideMap[i] < -500) { overrideMap[i] = heightMap[i]; }

			if (x >= margin && x < w - margin && y >= margin && y < h - margin) {
				let val = overrideMap[i];
				if (!isNaN(val)) {
					if (val < minH) minH = val;
					if (val > maxH) maxH = val;
				}
			}
		}
	}
	if (maxH <= minH || minH === Infinity || maxH === -Infinity) return;
	let range = maxH - minH;
	
	for (let i = 0; i < total; i++) overrideMap[i] = (overrideMap[i] - minH) / range;
	forceRender();
}

function applyRegionValue() {
	if (!hasSelection || !overrideMap) return;
	let val = parseFloat(document.getElementById("regionValue").value);
	let cols = noiseImg.width;
	let startX = Math.max(0, Math.floor(Math.min(selStartX, selEndX) / cellSize));
	let endX = Math.min(cols - 1, Math.floor(Math.max(selStartX, selEndX) / cellSize));
	let startY = Math.max(0, Math.floor(Math.min(selStartY, selEndY) / cellSize));
	let endY = Math.min(noiseImg.height - 1, Math.floor(Math.max(selStartY, selEndY) / cellSize));

	for (let y = startY; y <= endY; y++) {
		for (let x = startX; x <= endX; x++) overrideMap[x + y * cols] = val;
	}
	hasSelection = false;
	forceRender();
}

function clearOverrides() {
	if (!overrideMap) return;
	overrideMap.fill(-999);
	forceRender();
}

async function runErosion(mode) {
	if (!overrideMap || isEroding) return;
	isEroding = true;

	document.getElementById("btnErodeRand").disabled = true;
	document.getElementById("btnErodeAll").disabled = true;
	document.getElementById("erosionProgressContainer").style.display = "block";
	let statusText = document.getElementById("erosionStatusText");
	statusText.innerText = "Simulating Water Physics...";

	let cols = noiseImg.width, rows = noiseImg.height;

	for (let i = 0; i < cols * rows; i++) {
		if (overrideMap[i] < -500) overrideMap[i] = heightMap[i];
	}

	let startX = 1, endX = cols - 2, startY = 1, endY = rows - 2;
	if (document.getElementById("erodeSelection").checked && hasSelection) {
		startX = Math.max(1, Math.floor(Math.min(selStartX, selEndX) / cellSize));
		endX = Math.min(cols - 2, Math.floor(Math.max(selStartX, selEndX) / cellSize));
		startY = Math.max(1, Math.floor(Math.min(selStartY, selEndY) / cellSize));
		endY = Math.min(rows - 2, Math.floor(Math.max(selStartY, selEndY) / cellSize));
	}

	let isRandom = mode === "random";
	let numDrops = isRandom ? parseInt(document.getElementById("erodeCount").value) || 100000 : (endX - startX + 1) * (endY - startY + 1);
	let progressBar = document.getElementById("erosionProgress");
	progressBar.max = numDrops;
	progressBar.value = 0;

	let maxLife = parseInt(document.getElementById("erodeLife").value) || 40;
	let radius = parseInt(document.getElementById("erodeRadius").value) || 3;

    let erodeRate = parseFloat(document.getElementById("erodeRate").value);
    let evapRate = parseFloat(document.getElementById("evapRate").value);

    let inertia = 0.1;      
    let capFact = 8.0;      
    let minSlope = 0.05;    
    let depRate = 0.1;      
    let grav = 4.0;

	let brushOffsets = [];
	let brushWeights = [];
	let weightSum = 0;
	for (let by = -radius; by <= radius; by++) {
		for (let bx = -radius; bx <= radius; bx++) {
			let sqrDist = bx * bx + by * by;
			if (sqrDist <= radius * radius) {
				brushOffsets.push({ x: bx, y: by });
				let weight = 1 - Math.sqrt(sqrDist) / radius;
				brushWeights.push(weight);
				weightSum += weight;
			}
		}
	}
	for (let i = 0; i < brushWeights.length; i++) brushWeights[i] /= weightSum;

	let dropsProcessed = 0, batchSize = 25000, curX = startX, curY = startY;

	while (dropsProcessed < numDrops) {
		for (let b = 0; b < batchSize && dropsProcessed < numDrops; b++) {
			let x = isRandom ? startX + Math.random() * (endX - startX) : curX;
			let y = isRandom ? startY + Math.random() * (endY - startY) : curY;

			if (!isRandom) {
				curX++;
				if (curX > endX) { curX = startX; curY++; }
			}

			let dirX = 0, dirY = 0, speed = 1.0, water = 1.0, sediment = 0.0;

			for (let step = 0; step < maxLife; step++) {
				let ix = Math.floor(x), iy = Math.floor(y);
				let u = x - ix, v = y - iy;
				if (ix < 0 || ix >= cols - 1 || iy < 0 || iy >= rows - 1) break;

				let h00 = overrideMap[ix + iy * cols], h10 = overrideMap[ix + 1 + iy * cols];
				let h01 = overrideMap[ix + (iy + 1) * cols], h11 = overrideMap[ix + 1 + (iy + 1) * cols];

				let gx = (h10 - h00) * (1 - v) + (h11 - h01) * v;
				let gy = (h01 - h00) * (1 - u) + (h11 - h10) * u;

				dirX = dirX * inertia - gx * (1 - inertia);
				dirY = dirY * inertia - gy * (1 - inertia);
				let len = Math.sqrt(dirX * dirX + dirY * dirY);

				if (len !== 0) { dirX /= len; dirY /= len; } 
				else { dirX = Math.random() * 2 - 1; dirY = Math.random() * 2 - 1; }

				let nextX = x + dirX, nextY = y + dirY;
				if (nextX < 0 || nextX >= cols - 1 || nextY < 0 || nextY >= rows - 1) break;

				let nix = Math.floor(nextX), niy = Math.floor(nextY);
				let nu = nextX - nix, nv = nextY - niy;
				let nh00 = overrideMap[nix + niy * cols], nh10 = overrideMap[nix + 1 + niy * cols];
				let nh01 = overrideMap[nix + (niy + 1) * cols], nh11 = overrideMap[nix + 1 + (niy + 1) * cols];

				let hOld = h00 * (1 - u) * (1 - v) + h10 * u * (1 - v) + h01 * (1 - u) * v + h11 * u * v;
				let hNew = nh00 * (1 - nu) * (1 - nv) + nh10 * nu * (1 - nv) + nh01 * (1 - nu) * nv + nh11 * nu * nv;
				let deltaH = hOld - hNew;

				let capacity = Math.max(deltaH, minSlope) * speed * water * capFact;

				if (sediment > capacity || deltaH < 0) {
					let amount = deltaH < 0 ? Math.min(deltaH * -1, sediment) : (sediment - capacity) * depRate;
					sediment -= amount;
					overrideMap[ix + iy * cols] += amount * (1 - u) * (1 - v);
					overrideMap[ix + 1 + iy * cols] += amount * u * (1 - v);
					overrideMap[ix + (iy + 1) * cols] += amount * (1 - u) * v;
					overrideMap[ix + 1 + (iy + 1) * cols] += amount * u * v;
				} else {
					let amount = Math.min((capacity - sediment) * erodeRate, deltaH);
					sediment += amount;
					for (let i = 0; i < brushOffsets.length; i++) {
						let bx = ix + brushOffsets[i].x;
						let by = iy + brushOffsets[i].y;
						if (bx >= 0 && bx < cols && by >= 0 && by < rows) {
							let bIdx = bx + by * cols;
							overrideMap[bIdx] -= amount * brushWeights[i];
						}
					}
				}

				let speedSq = speed * speed + deltaH * grav;
				if (speedSq < 0) break; 
				speed = Math.sqrt(speedSq);
				water *= 1 - evapRate;
				x = nextX;
				y = nextY;

				if (water < 0.01) break;

				let waterLvl = parseFloat(document.getElementById("shallowWater").value);
				if (hNew <= waterLvl-10) {
					let ix = Math.floor(x), iy = Math.floor(y);
					let u = x - ix, v = y - iy;
					overrideMap[ix + iy * cols] += sediment * (1 - u) * (1 - v);
					overrideMap[ix + 1 + iy * cols] += sediment * u * (1 - v);
					overrideMap[ix + (iy + 1) * cols] += sediment * (1 - u) * v;
					overrideMap[ix + 1 + (iy + 1) * cols] += sediment * u * v;
					break;
				}
			}
			dropsProcessed++;
		}
		progressBar.value = dropsProcessed;
		needsUpdate = true;
		await new Promise((r) => setTimeout(r, 0)); 
	}

	if (document.getElementById("postErosionBlur") && document.getElementById("postErosionBlur").checked) {
		statusText.innerText = "Applying Thermal Weathering...";
		await new Promise((r) => setTimeout(r, 0));

		let tempMap = new Float32Array(cols * rows);
		let waterLvl = parseFloat(document.getElementById("shallowWater").value);

		for (let y = 1; y < rows - 1; y++) {
			for (let x = 1; x < cols - 1; x++) {
				let idx = x + y * cols;
				if (overrideMap[idx] <= waterLvl) {
					tempMap[idx] = overrideMap[idx];
					continue;
				}

				let sum = overrideMap[idx] + overrideMap[idx - 1] + overrideMap[idx + 1] +
					overrideMap[idx - cols] + overrideMap[idx + cols] +
					overrideMap[idx - cols - 1] + overrideMap[idx - cols + 1] +
					overrideMap[idx + cols - 1] + overrideMap[idx + cols + 1];
				tempMap[idx] = sum / 9.0;
			}
		}
		for (let i = 0; i < cols * rows; i++) overrideMap[i] = tempMap[i];
	}

	document.getElementById("erosionProgressContainer").style.display = "none";
	document.getElementById("btnErodeRand").disabled = false;
	document.getElementById("btnErodeAll").disabled = false;
	isEroding = false;
	needsUpdate = true;
}

function downloadMap() {
	if (noiseImg) noiseImg.save("terrain_map", "png");
}

function uploadMap() {
	let input = document.createElement("input");
	input.type = "file";
	input.accept = "image/png, image/jpeg, image/jpg";

	input.onchange = (e) => {
		let file = e.target.files[0];
		if (!file) return;

		let url = URL.createObjectURL(file);

		loadImage(url, (img) => {
			document.getElementById("mapWidth").value = img.width * cellSize;
			document.getElementById("mapHeight").value = img.height * cellSize;

			updateMapSize();
			img.loadPixels();
			let totalPixels = img.width * img.height;

			for (let i = 0; i < totalPixels; i++) {
				let pIdx = i * 4;
				let r = img.pixels[pIdx];
				let g = img.pixels[pIdx + 1];
				let b = img.pixels[pIdx + 2];
				let brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255.0;
				overrideMap[i] = brightness;
			}

			towns = [];
			roads = [];
			hasSelection = false;

			URL.revokeObjectURL(url);
			console.log(`Successfully loaded ${img.width}x${img.height} image as terrain!`);
			forceRender();
		});
	};

	input.click();
}

function updateUIValues() {
	cellSize = parseInt(document.getElementById("cellSize").value);
	noiseZoom = parseFloat(document.getElementById("noiseZoom").value);

	let minEl = document.getElementById("townSizeMin");
	let maxEl = document.getElementById("townSizeMax");
	if (minEl && maxEl) {
		if (parseInt(minEl.value) > parseInt(maxEl.value)) maxEl.value = minEl.value;
		let strEl = document.getElementById("v-townSizeStr");
		if (strEl) strEl.innerText = minEl.value + " - " + maxEl.value;
	}

	const ids = ["cellSize", "noiseZoom", "elevation", "contrast", "sunAngle", "sunHeight", "shadowDarkness", "shadowBlur", "shadowBias", "diffuseSmooth", "townCount", "townSpacing", "townMaxSlope", "roadSteepness", "shallowWaterBais", "erodeRate", "evapRate", "townIrregularity", "buildingSpacing", "densityDecline","roadStep", "roadOpacity", "roadThickness"];
	ids.forEach((id) => {
		let el = document.getElementById(`v-${id}`);
		if (!el) return;
		let value = document.getElementById(id).value;
		if (id === "sunAngle") value = value + "°";
		else if (id === "cellSize" || id === "roadThickness") value = value + "px";
		else if (id === "shallowWaterBais") value = (value >= 0 ? "+" : "") + value + "%";
        else if (id === 'erodeRate' || id === 'evapRate' || id === 'roadOpacity') value = Math.round(value * 100) + '%';
        
		el.innerText = value;
	});

	const biomes = ["deepWater", "shallowWater", "sand", "grass", "forest", "rock"];
	biomes.forEach((id) => (document.getElementById(`v-${id}`).innerText = Math.round(document.getElementById(id).value * 100) + "%"));

	buildColorLUT();
	if (noiseImg && (Math.ceil(mapWidth / cellSize) !== noiseImg.width || Math.ceil(mapHeight / cellSize) !== noiseImg.height))
		createGridImage();
}

function createGridImage() {
	let cols = Math.ceil(mapWidth / cellSize), rows = Math.ceil(mapHeight / cellSize);
	noiseImg = createImage(cols, rows);
	let totalPixels = cols * rows;

	heightMap = new Float32Array(totalPixels);
	shadowMap = new Float32Array(totalPixels);
	blurTempMap = new Float32Array(totalPixels);
	overrideMap = new Float32Array(totalPixels).fill(-999);
	
	townHeightMap = new Float32Array(totalPixels).fill(-999);
	roadMap = new Uint8Array(totalPixels).fill(0);

	gScoreMap = new Float32Array(totalPixels);
	fScoreMap = new Float32Array(totalPixels);
	cameFromMap = new Int32Array(totalPixels);

	updateNoiseScale(cols, rows);
	if (document.getElementById("autoUpdate").checked) needsUpdate = true;
}

function draw() {
	if (document.getElementById("autoUpdate").checked) {
		if (document.getElementById("animate").checked) {
			zOff += 0.015;
			needsUpdate = true;
		}
		if (document.getElementById("orbitSun").checked) {
			let sSlider = document.getElementById("sunAngle");
			sSlider.value = (parseFloat(sSlider.value) + 1) % 360;
			document.getElementById("v-sunAngle").innerText = Math.round(sSlider.value) + "°";
			needsUpdate = true;
		}
	}
	if (needsUpdate) {
		generateTerrain();
		needsUpdate = false;
	}

	background(0);
	push();
	translate(panX, panY);
	scale(zoom);
	image(noiseImg, 0, 0, noiseImg.width * cellSize, noiseImg.height * cellSize);
	
	// =======================================================
	// RENDER TOWNS LAYER
	// =======================================================
	if (document.getElementById("showTowns").checked) {
		let style1 = document.getElementById("townRenderStyle") ? document.getElementById("townRenderStyle").value : "emoji";
		
		let sunAng = parseFloat(document.getElementById("sunAngle").value) * (Math.PI / 180);
		let sDx = Math.cos(sunAng);
		let sDy = Math.sin(sunAng);

		for (let t of towns) {
			if (style1 === "city") {
				// PASS 1: DRAW BUILDING DROP SHADOWS
				fill(0, 0, 0, 70);
				noStroke();
				for (let b of t.buildings) {
					let bx = b.x * cellSize;
					let by = b.y * cellSize;
					let bw = b.w * cellSize;
					let bh = b.h * cellSize;
					let shadowLen = (b.w + b.h) * 0.2 * cellSize; 

					rect(bx + sDx * shadowLen, by + sDy * shadowLen, bw, bh);
				}

				// PASS 2: DRAW PROCEDURAL BUILDINGS
				for (let b of t.buildings) {
					let bx = b.x * cellSize;
					let by = b.y * cellSize;
					let bw = b.w * cellSize;
					let bh = b.h * cellSize;

					fill(b.color);
					stroke(40, 40, 40);
					strokeWeight(0.5);
					rect(bx, by, bw, bh);

					stroke(20, 20, 20, 150);
					if (b.roof === 'gabled_h') {
						line(bx, by + bh/2, bx + bw, by + bh/2);
					} else if (b.roof === 'gabled_v') {
						line(bx + bw/2, by, bx + bw/2, by + bh);
					} else if (b.roof === 'pyramid') {
						line(bx, by, bx + bw, by + bh);
						line(bx + bw, by, bx, by + bh);
					}
				}
			} 
			else {
				let screenX = t.x * cellSize + cellSize / 2;
				let screenY = t.y * cellSize + cellSize / 2;
				let radiusPx = t.size * cellSize;

				stroke(255, 0, 0, 150); 
				strokeWeight(2 / zoom); 
				fill(255, 0, 0, 25);
				circle(screenX, screenY, radiusPx * 2);

				noStroke();
				textAlign(CENTER, CENTER);
				textSize(Math.max(12 / zoom, 2)); 
				text(t.icon, screenX, screenY);
			}
		}
	}

	if (hasSelection) {
		stroke(255, 0, 0, 200);
		strokeWeight(2 / zoom);
		fill(255, 0, 0, 50);
		rect(Math.min(selStartX, selEndX), Math.min(selStartY, selEndY), Math.abs(selEndX - selStartX), Math.abs(selEndY - selStartY));
	}
	pop();
}

function windowResized() {
	resizeCanvas(windowWidth, windowHeight);
}

function saveSettings() {
	let settings = { seedOffsetX, seedOffsetY };
	document.querySelectorAll("#ui input, #ui select").forEach(el => settings[el.id] = el.type === "checkbox" ? el.checked : el.value);
	localStorage.setItem("fastTerrainSettings3", JSON.stringify(settings));

	let btn = document.getElementById("saveBtn");
	btn.innerText = "Saved ✓";
	btn.style.background = "#2E7D32";
	setTimeout(() => {
		btn.innerText = "Save Settings";
		btn.style.background = "#4CAF50";
	}, 1000);
}

function loadSettings() {
	let saved = localStorage.getItem("fastTerrainSettings3");
	if (saved) {
		let s = JSON.parse(saved);
		seedOffsetX = s.seedOffsetX || 0;
		seedOffsetY = s.seedOffsetY || 0;
		for (let key in s) {
			let el = document.getElementById(key);
			if (el) el.type === "checkbox" ? (el.checked = s[key]) : (el.value = s[key]);
		}
	}
}

function resetSettings() {
	localStorage.removeItem("fastTerrainSettings3");
	location.reload();
}