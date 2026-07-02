import { setMinimapCamera, getMiniViewer, getViewer, setPauseMinimapCamera, getPauseMiniViewer } from '../world/cesiumWorld';
import { calculateDistance } from '../world/regions';
import * as Cesium from 'cesium';

export class HUD {
	constructor() {
		this.speedElem = document.getElementById('speed');
		this.altElem = document.getElementById('altitude');
		this.timeElem = document.getElementById('time');
		this.scoreElem = document.getElementById('score');
		this.fpsElem = document.getElementById('fps');
		this.localDateTimeElem = document.getElementById('local-datetime');
		this.coordsElem = document.getElementById('coords');
		this.minimapCanvas = document.getElementById('minimap');
		this.miniCtx = this.minimapCanvas.getContext('2d');

		this.pauseMinimapCanvas = document.getElementById('pauseMinimap');
		if (this.pauseMinimapCanvas) {
			this.pauseMiniCtx = this.pauseMinimapCanvas.getContext('2d');
		}
		this.pauseRegionElem = document.getElementById('pause-region');
		this.pauseLatElem = document.getElementById('pause-lat');
		this.pauseLonElem = document.getElementById('pause-lon');
		this.pauseAltElem = document.getElementById('pause-alt');
		this.pauseTimeElem = document.getElementById('pause-time');

		this.uiContainer = document.getElementById('uiContainer');
		this.compassTape = document.getElementById('compass-tape');
		this.headingDisplay = document.getElementById('heading-display');

		this.regionNotif = document.getElementById('region-notification');
		this.regionNameElem = document.getElementById('region-name');
		this.regionTimeout = null;

		this.pullUpElem = document.getElementById('pull-up-warning');

		this.killNotifContainer = document.getElementById('kill-notification-container');
		this.killTextElem = document.getElementById('kill-text');
		this.killScoreElem = document.getElementById('kill-score');
		this.killTimeout = null;

		this.weaponElems = {
			gun: document.getElementById('weapon-gun'),
			missile: document.getElementById('weapon-missile'),
			flare: document.getElementById('weapon-flare')
		};
		this.weaponAmmoElems = {
			gun: this.weaponElems.gun.querySelector('.weapon-ammo'),
			missile: this.weaponElems.missile.querySelector('.weapon-ammo'),
			flare: this.weaponElems.flare.querySelector('.weapon-ammo')
		};
		this.weaponProgressElems = {
			gun: this.weaponElems.gun.querySelector('.weapon-progress'),
			missile: this.weaponElems.missile.querySelector('.weapon-progress'),
			flare: this.weaponElems.flare.querySelector('.weapon-progress')
		};

		this.vignette = document.getElementById('transition-vignette');

		this.startTime = Date.now();

		this.smoothedPitch = 0;
		this.smoothedRoll = 0;
		this.smoothedHeading = 0;
		this.smoothedThrottle = 0;
		this.smoothedYaw = 0;
		this.smoothedBoostScale = 1.0;
		this.currentShakeX = 0;
		this.currentShakeY = 0;

		this.minimapRange = 1;
		this.showHorizonLines = false;

		this.npcMarkers = new Map();
		this.npcContainer = document.createElement('div');
		this.npcContainer.id = 'npc-markers-layer';
		this.npcContainer.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:15;';
		this.uiContainer.appendChild(this.npcContainer);

		this.createHorizon();
		this.createMissileCrosshair();
		this.createCompass();
		this.resizeMinimap();
		window.addEventListener('resize', () => this.resizeMinimap());
	}

	createMissileCrosshair() {
		if (document.getElementById('missile-crosshair')) return;

		const cross = document.createElement('div');
		cross.id = 'missile-crosshair';
		cross.style.cssText = `
			position: absolute;
			left: 50%;
			top: 50%;
			transform: translate(-50%, -50%);
			width: 220px;
			height: 220px;
			display: none;
		`;

		const innerRing = document.createElement('div');
		innerRing.style.cssText = `
			position:absolute; left:50%; top:50%; width:76px; height:76px; transform:translate(-50%,-50%);
			border-radius:50%;
			border:2px solid #0f0;
		`;

		const centerDot = document.createElement('div');
		centerDot.style.cssText = `position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:10px; height:10px; border-radius:50%; background:#0f0;`;

		const makeTick = (left, top, w, h, translate) => {
			const t = document.createElement('div');
			t.style.cssText = `position:absolute; left:${left}; top:${top}; width:${w}; height:${h}; background:#0f0; transform:${translate};`;
			return t;
		};

		const tickOffset = 48;
		const tickLen = 18;

		const leftTick = makeTick('calc(50% - ' + tickOffset + 'px - ' + (tickLen / 2) + 'px)', '50%', '18px', '2px', 'translateY(-50%)');
		const rightTick = makeTick('calc(50% + ' + tickOffset + 'px - ' + (tickLen / 2) + 'px)', '50%', '18px', '2px', 'translateY(-50%)');
		const topTick = makeTick('50%', 'calc(50% - ' + tickOffset + 'px - ' + (tickLen / 2) + 'px)', '2px', tickLen + 'px', 'translateX(-50%)');

		cross.appendChild(innerRing);
		cross.appendChild(centerDot);
		cross.appendChild(topTick);
		cross.appendChild(leftTick);
		cross.appendChild(rightTick);

		const horizon = document.getElementById('horizon-container');
		if (horizon) horizon.appendChild(cross);
		else this.uiContainer.appendChild(cross);
		this.missileCrosshair = cross;
	}

	showMissileCrosshair(shouldShow) {
		if (!this.missileCrosshair) return;
		const normal = document.getElementById('normal-crosshair');
		if (shouldShow) {
			if (normal) normal.style.display = 'none';
			this.missileCrosshair.style.display = 'block';
		} else {
			this.missileCrosshair.style.display = 'none';
			if (normal) normal.style.display = 'flex';
		}
	}

	createCompass() {
		if (!this.compassTape) return;

		const step = 5;
		const pixelsPerDegree = 4;

		this.compassTape.innerHTML = '';

		for (let i = -360; i <= 720; i += step) {
			const tick = document.createElement('div');
			tick.className = 'compass-tick';

			const isMajor = i % 10 === 0;
			const isCardinal = i % 90 === 0;

			tick.style.left = `${(i + 360) * pixelsPerDegree}px`;
			tick.style.height = isMajor ? '10px' : '5px';

			if (isMajor) {
				const label = document.createElement('div');
				label.className = 'compass-label';
				label.style.left = `${(i + 360) * pixelsPerDegree}px`;

				let degree = i % 360;
				if (degree < 0) degree += 360;

				let text = Math.round(degree).toString().padStart(3, '0');
				if (Math.round(degree) === 0 || Math.round(degree) === 360) text = 'N';
				else if (Math.round(degree) === 90) text = 'E';
				else if (Math.round(degree) === 180) text = 'S';
				else if (Math.round(degree) === 270) text = 'W';

				label.innerText = text;
				this.compassTape.appendChild(label);
			}

			this.compassTape.appendChild(tick);
		}
	}

	resetTime() {
		this.startTime = Date.now();
	}

	setMinimapRange(range) {
		this.minimapRange = range;
	}

	setShowHorizonLines(show) {
		this.showHorizonLines = show;
		const lines = document.getElementById('pitch-lines');
		if (lines) {
			lines.style.display = show ? 'block' : 'none';
		}
	}

	showKillNotification(npcName, scoreGain) {
		if (this.killTimeout) clearTimeout(this.killTimeout);

		if (this.killNotifContainer) {
			this.killNotifContainer.classList.remove('hidden');
			this.killNotifContainer.classList.remove('kill-notification-exit');

			const targetText = `${npcName} DESTROYED`;
			const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
			let iteration = 0;
			if (this.glitchInterval) clearInterval(this.glitchInterval);

			this.glitchInterval = setInterval(() => {
				if (this.killTextElem) {
					const currentPos = Math.floor(iteration);

					const processedText = targetText.split("")
						.map((char, index) => {
							if (index < currentPos) return targetText[index];
							if (index === currentPos) return chars[Math.floor(Math.random() * chars.length)];
							return "";
						})
						.join("");

					const cursor = currentPos < targetText.length ? (Math.random() > 0.5 ? "_" : " ") : "";
					this.killTextElem.innerText = processedText + cursor;
				}

				if (iteration >= targetText.length) {
					if (this.killTextElem) this.killTextElem.innerText = targetText;
					clearInterval(this.glitchInterval);
				}

				iteration += 1;
			}, 40);

			if (this.killScoreElem) this.killScoreElem.innerText = `+${scoreGain}`;

			this.killNotifContainer.style.animation = 'none';
			this.killNotifContainer.offsetHeight;
			this.killNotifContainer.style.animation = null;

			this.killTimeout = setTimeout(() => {
				this.killNotifContainer.classList.add('kill-notification-exit');

				setTimeout(() => {
					this.killNotifContainer.classList.add('hidden');
					this.killNotifContainer.classList.remove('kill-notification-exit');
				}, 500);

				if (this.glitchInterval) clearInterval(this.glitchInterval);
			}, 3000);
		}
	}

	showRegion(name) {
		if (this.regionTimeout) {
			clearTimeout(this.regionTimeout);
		}

		this.regionNameElem.innerText = name;
		this.regionNotif.classList.remove('hidden');
		this.regionNotif.classList.remove('region-exit');

		this.regionTimeout = setTimeout(() => {
			this.regionNotif.classList.add('region-exit');
			this.regionTimeout = setTimeout(() => {
				this.regionNotif.classList.add('hidden');
				this.regionTimeout = null;
			}, 1000);
		}, 4000);
	}

	setPullUpWarning(shouldShow) {
		if (this.pullUpElem) {
			if (shouldShow) {
				this.pullUpElem.classList.remove('hidden');
			} else {
				this.pullUpElem.classList.add('hidden');
			}
		}
	}

	resizeMinimap() {
		requestAnimationFrame(() => {
			this.minimapCanvas.width = this.minimapCanvas.offsetWidth;
			this.minimapCanvas.height = this.minimapCanvas.offsetHeight;

			if (this.pauseMinimapCanvas) {
				this.pauseMinimapCanvas.width = this.pauseMinimapCanvas.offsetWidth;
				this.pauseMinimapCanvas.height = this.pauseMinimapCanvas.offsetHeight;
			}

			const miniViewer = getMiniViewer();
			if (miniViewer) {
				miniViewer.resize();
			}

			const pauseMiniViewer = getPauseMiniViewer();
			if (pauseMiniViewer) {
				pauseMiniViewer.resize();
			}
		});
	}

	createHorizon() {
		if (!document.getElementById('horizon-container')) {
			const ui = document.getElementById('uiContainer');
			const horizon = document.createElement('div');
			horizon.id = 'horizon-container';
			horizon.style.cssText = `
				position: absolute;
				top: 50%;
				left: 50%;
				width: 600px;
				height: 600px;
				transform: translate(-50%, -50%);
				pointer-events: none;
				overflow: hidden;
			`;

			const crosshair = document.createElement('div');
			crosshair.id = 'normal-crosshair';
			crosshair.style.cssText = 'position:absolute; top:50%; left:50%; width:120px; height:48px; transform:translate(-50%,-50%); pointer-events:none;';

			const ring = document.createElement('div');
			ring.style.cssText = 'position:absolute; left:50%; top:50%; width:12px; height:12px; transform:translate(-50%,-50%); border-radius:50%; border:2px solid #0f0; background:transparent;';

			const leftLine = document.createElement('div');
			leftLine.style.cssText = 'position:absolute; top:50%; left:calc(50% - 6px - 20px); width:20px; height:2px; transform:translateY(-50%); background:#0f0;';

			const rightLine = document.createElement('div');
			rightLine.style.cssText = 'position:absolute; top:50%; left:calc(50% + 6px); width:20px; height:2px; transform:translateY(-50%); background:#0f0;';

			const topTick = document.createElement('div');
			topTick.style.cssText = 'position:absolute; left:50%; top:calc(50% - 6px - 12px); width:2px; height:12px; transform:translateX(-50%); background:#0f0;';

			crosshair.appendChild(leftLine);
			crosshair.appendChild(rightLine);
			crosshair.appendChild(ring);
			crosshair.appendChild(topTick);
			horizon.appendChild(crosshair);

			const pitchLines = document.createElement('div');
			pitchLines.id = 'pitch-lines';
			pitchLines.style.cssText = `
				position: absolute;
				width: 100%;
				height: 100%;
			`;

			for (let i = -90; i <= 90; i += 10) {
				if (i === 0) continue;
				const line = document.createElement('div');
				line.style.cssText = `
					position: absolute;
					left: 30%;
					width: 40%;
					height: 1px;
					background: rgba(0, 255, 0, 0.5);
					top: ${50 - i}% ;
					text-align: center;
					font-size: 10px;
				`;
				line.innerText = i;
				pitchLines.appendChild(line);
			}

			horizon.appendChild(pitchLines);
			ui.appendChild(horizon);

			this.setShowHorizonLines(this.showHorizonLines);
		}
	}

	updatePauseMenu(state, currentRegionName, npcs = []) {
		if (this.pauseRegionElem) this.pauseRegionElem.innerText = currentRegionName || "UNKNOWN REGION";

		if (this.pauseLatElem) {
			const latDir = state.lat >= 0 ? 'N' : 'S';
			this.pauseLatElem.innerText = `${Math.abs(state.lat).toFixed(4)}°${latDir}`;
		}
		if (this.pauseLonElem) {
			const lonDir = state.lon >= 0 ? 'E' : 'W';
			this.pauseLonElem.innerText = `${Math.abs(state.lon).toFixed(4)}°${lonDir}`;
		}
		if (this.pauseAltElem) {
			const altFeet = Math.max(0, Math.round(state.alt * 3.28084));
			this.pauseAltElem.innerText = `${altFeet.toLocaleString()} FT`;
		}

		if (this.pauseTimeElem) {
			const now = new Date();
			const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
			const tzOffsetHours = Math.round((state.lon || 0) / 15);
			const localDate = new Date(utc + (3600000 * tzOffsetHours));

			const yyyy = localDate.getFullYear();
			const mm = (localDate.getMonth() + 1).toString().padStart(2, '0');
			const dd = localDate.getDate().toString().padStart(2, '0');
			const hh = localDate.getHours().toString().padStart(2, '0');
			const min = localDate.getMinutes().toString().padStart(2, '0');
			const ss = localDate.getSeconds().toString().padStart(2, '0');

			this.pauseTimeElem.innerText = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
		}

		const zoomAlt = this.minimapRange * 10000;
		setPauseMinimapCamera(state.lon, state.lat, zoomAlt, 0);

		if (!this.pauseMiniCtx || !this.pauseMinimapCanvas) return;
		const ctx = this.pauseMiniCtx;
		const w = this.pauseMinimapCanvas.width;
		const h = this.pauseMinimapCanvas.height;
		const centerX = w / 2;
		const centerY = h / 2;

		ctx.clearRect(0, 0, w, h);

		ctx.strokeStyle = 'rgba(0, 255, 0, 0.2)';
		ctx.lineWidth = 1;
		const gridSize = 50;

		ctx.beginPath();
		for (let x = centerX; x <= w; x += gridSize) {
			ctx.moveTo(x, 0); ctx.lineTo(x, h);
		}
		for (let x = centerX - gridSize; x >= 0; x -= gridSize) {
			ctx.moveTo(x, 0); ctx.lineTo(x, h);
		}
		for (let y = centerY; y <= h; y += gridSize) {
			ctx.moveTo(0, y); ctx.lineTo(w, y);
		}
		for (let y = centerY - gridSize; y >= 0; y -= gridSize) {
			ctx.moveTo(0, y); ctx.lineTo(w, y);
		}
		ctx.stroke();

		ctx.strokeStyle = '#0f0';
		ctx.lineWidth = 2;
		const size = 15;
		ctx.beginPath();
		ctx.moveTo(centerX - size, centerY); ctx.lineTo(centerX + size, centerY);
		ctx.moveTo(centerX, centerY - size); ctx.lineTo(centerX, centerY + size);
		ctx.stroke();

		ctx.fillStyle = '#0f0';
		ctx.font = '12px AceCombat';
		ctx.fillText("YOU", centerX + 20, centerY + 5);

		const verticalMeters = zoomAlt * 1.1547;
		const pixelsPerMeter = h / verticalMeters;

		npcs.forEach(npc => {
			const dx_m = (npc.lon - state.lon) * 111320 * Math.cos(state.lat * Math.PI / 180);
			const dy_m = (npc.lat - state.lat) * 111320;

			const px = centerX + dx_m * pixelsPerMeter;
			const py = centerY - dy_m * pixelsPerMeter;

			if (px < 0 || px > w || py < 0 || py > h) return;

			ctx.strokeStyle = '#fff';
			ctx.lineWidth = 2;
			ctx.save();
			ctx.translate(px, py);
			ctx.rotate(45 * Math.PI / 180);
			ctx.beginPath();
			ctx.rect(-5, -5, 10, 10);
			ctx.stroke();
			ctx.restore();

			ctx.fillStyle = '#fff';
			ctx.font = '10px AceCombat';
			ctx.fillText(npc.name || "BOGEY", px + 10, py + 5);
		});
	}

	update(state, npcs = []) {
		const lerpFactor = 0.5;

		const lerpAngle = (current, target, factor) => {
			let diff = target - current;
			while (diff < -180) diff += 360;
			while (diff > 180) diff -= 360;
			return current + diff * factor;
		};

		const getAngleDiff = (target, current) => {
			let diff = target - current;
			while (diff < -180) diff += 360;
			while (diff > 180) diff -= 360;
			return diff;
		};

		const normalizeAngle = (a) => {
			while (a <= -180) a += 360;
			while (a > 180) a -= 360;
			return a;
		};

		this.smoothedPitch = lerpAngle(this.smoothedPitch, state.pitch, lerpFactor);
		this.smoothedRoll = lerpAngle(this.smoothedRoll, state.roll, lerpFactor);
		this.smoothedHeading = lerpAngle(this.smoothedHeading, state.heading || 0, lerpFactor);
		this.smoothedThrottle = this.smoothedThrottle + ((state.throttle || 0) - this.smoothedThrottle) * (lerpFactor * 0.4);
		this.smoothedYaw = this.smoothedYaw + ((state.yaw || 0) - this.smoothedYaw) * lerpFactor;

		this.smoothedPitch = normalizeAngle(this.smoothedPitch);
		this.smoothedRoll = normalizeAngle(this.smoothedRoll);
		this.smoothedHeading = normalizeAngle(this.smoothedHeading);

		const baseZoom = this.minimapRange * 1500;
		const speedFactor = this.minimapRange * 2;
		let zoomAlt = baseZoom + (state.speed * speedFactor);
		if (state.isBoosting) zoomAlt *= 1.2;
		this.currentZoom = zoomAlt;
		setMinimapCamera(state.lon, state.lat, zoomAlt, this.smoothedHeading);

		const isBoosting = state.isBoosting || false;
		if (this.vignette) {
			this.vignette.style.opacity = isBoosting ? "1" : "0";
		}

		const pitchDiff = getAngleDiff(state.pitch, this.smoothedPitch);
		const rollDiff = getAngleDiff(state.roll, this.smoothedRoll);
		const yawDiff = (state.yaw || 0) - this.smoothedYaw;
		const throttleDiff = (state.throttle || 0) - this.smoothedThrottle;

		if (this.uiContainer) {
			const maxTilt = 15;
			const tiltX = Math.max(-maxTilt, Math.min(maxTilt, pitchDiff * 0.8));
			const tiltY = Math.max(-maxTilt, Math.min(maxTilt, -rollDiff * 0.3 + yawDiff * 5.0));

			const maxShift = 50;
			const shiftX = Math.max(-maxShift, Math.min(maxShift, -rollDiff * 1.5 - yawDiff * 20.0));
			const shiftY = Math.max(-maxShift, Math.min(maxShift, pitchDiff * 3.0 + throttleDiff * 15.0));

			const targetBoostScale = isBoosting ? 1.02 : 1.0;
			this.smoothedBoostScale = this.smoothedBoostScale + (targetBoostScale - this.smoothedBoostScale) * 0.1;

			const scale = (1 + (throttleDiff * 0.25)) * this.smoothedBoostScale;

			if (isBoosting) {
				const time = Date.now() * 0.05;
				this.currentShakeX = Math.sin(time * 1.5) * 2 + Math.cos(time * 2.1) * 1.5;
				this.currentShakeY = Math.cos(time * 1.7) * 2 + Math.sin(time * 2.3) * 1.5;
			} else {
				this.currentShakeX *= 0.85;
				this.currentShakeY *= 0.85;
			}

			this.uiContainer.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translate(${shiftX + this.currentShakeX}px, ${shiftY + this.currentShakeY}px) scale(${scale})`;
		}

		this.speedElem.innerText = Math.round(state.speed).toString().padStart(3, '0');

		if (state.weaponSystem) {
			this.updateWeapons(state.weaponSystem);
		}

		let compassHeading = this.smoothedHeading;
		while (compassHeading < 0) compassHeading += 360;
		while (compassHeading >= 360) compassHeading -= 360;

		if (this.headingDisplay) {
			let displayHeading = Math.round(compassHeading);
			if (displayHeading === 360) displayHeading = 0;

			let cardinal = '';
			if (displayHeading >= 337.5 || displayHeading < 22.5) cardinal = 'N';
			else if (displayHeading >= 22.5 && displayHeading < 67.5) cardinal = 'NE';
			else if (displayHeading >= 67.5 && displayHeading < 112.5) cardinal = 'E';
			else if (displayHeading >= 112.5 && displayHeading < 157.5) cardinal = 'SE';
			else if (displayHeading >= 157.5 && displayHeading < 202.5) cardinal = 'S';
			else if (displayHeading >= 202.5 && displayHeading < 247.5) cardinal = 'SW';
			else if (displayHeading >= 247.5 && displayHeading < 292.5) cardinal = 'W';
			else if (displayHeading >= 292.5 && displayHeading < 337.5) cardinal = 'NW';

			this.headingDisplay.innerText = `${displayHeading.toString().padStart(3, '0')} ${cardinal}`;
		}

		if (this.compassTape) {
			const pixelsPerDegree = 4;
			const centerOffset = 160;
			const targetPosOnTape = (compassHeading + 360) * pixelsPerDegree;
			const offset = centerOffset - targetPosOnTape;
			this.compassTape.style.transform = `translateX(${offset}px)`;
		}

		const altFeet = Math.max(0, Math.round(state.alt * 3.28084));
		this.altElem.innerText = altFeet.toString().padStart(5, '0');

		if (this.scoreElem) {
			this.scoreElem.innerText = (state.score || 0).toString().padStart(6, '0');
		}

		const elapsedMs = Date.now() - this.startTime;
		const m = Math.floor(elapsedMs / 60000);
		const s = Math.floor((elapsedMs % 60000) / 1000);
		const cs = Math.floor((elapsedMs % 1000) / 10);
		this.timeElem.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}:${cs.toString().padStart(2, '0')}`;

		const now = new Date();
		const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
		const tzOffsetHours = Math.round((state.lon || 0) / 15);
		const localDate = new Date(utc + (3600000 * tzOffsetHours));

		if (this.localDateTimeElem) {
			const yyyy = localDate.getFullYear();
			const mm = (localDate.getMonth() + 1).toString().padStart(2, '0');
			const dd = localDate.getDate().toString().padStart(2, '0');
			const hh = localDate.getHours().toString().padStart(2, '0');
			const min = localDate.getMinutes().toString().padStart(2, '0');
			const ss = localDate.getSeconds().toString().padStart(2, '0');

			this.localDateTimeElem.innerText = `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}Z`;
		}

		if (this.coordsElem) {
			const latDir = state.lat >= 0 ? 'N' : 'S';
			const lonDir = state.lon >= 0 ? 'E' : 'W';
			this.coordsElem.innerText = `POS: ${Math.abs(state.lat).toFixed(4)}°${latDir} ${Math.abs(state.lon).toFixed(4)}°${lonDir}`;
		}

		const pitchLines = document.getElementById('pitch-lines');
		const horizon = document.getElementById('horizon-container');
		if (pitchLines && horizon) {
			horizon.style.transform = `translate(-50%, -50%) rotate(${-this.smoothedRoll}deg)`;
			pitchLines.style.transform = `translateY(${this.smoothedPitch * 6}px)`;
		}

		this.drawMinimap(state, npcs);
		this.updateNPCMarkers(npcs, state);
	}

	drawMinimap(state, npcs = []) {
		if (!this.miniCtx || !this.minimapCanvas) return;

		const ctx = this.miniCtx;
		const w = this.minimapCanvas.width || 250;
		const h = this.minimapCanvas.height || 250;
		const centerX = w / 2;
		const centerY = h / 2;
		const radius = Math.min(centerX, centerY) - 10;

		ctx.clearRect(0, 0, w, h);

		ctx.save();
		ctx.translate(centerX, centerY);

		const heading = this.smoothedHeading;
		ctx.rotate(-heading * Math.PI / 180);

		ctx.strokeStyle = 'rgba(0, 255, 0, 0.35)';
		ctx.lineWidth = 1.0;

		const metersPerGrid = this.minimapRange * 1000;
		const verticalMeters = (this.currentZoom || (this.minimapRange * 1500)) * 1.1547;
		const gridSize = (metersPerGrid * h) / verticalMeters;
		const pixelsPerMeter = h / verticalMeters;

		const circleRadius = Math.min(10000 * pixelsPerMeter, radius);

		const limit = radius * 2;
		for (let x = 0; x <= limit; x += gridSize) {
			ctx.beginPath();
			ctx.moveTo(x, -limit); ctx.lineTo(x, limit); ctx.stroke();
			if (x > 0) {
				ctx.beginPath();
				ctx.moveTo(-x, -limit); ctx.lineTo(-x, limit); ctx.stroke();
			}
		}
		for (let y = 0; y <= limit; y += gridSize) {
			ctx.beginPath();
			ctx.moveTo(-limit, y); ctx.lineTo(limit, y); ctx.stroke();
			if (y > 0) {
				ctx.beginPath();
				ctx.moveTo(-limit, -y); ctx.lineTo(limit, -y); ctx.stroke();
			}
		}

		npcs.forEach(npc => {
			const dist = calculateDistance(state.lon, state.lat, npc.lon, npc.lat);
			if (dist > this.minimapRange * 5000) return;

			const dx_m = (npc.lon - state.lon) * 111320 * Math.cos(state.lat * Math.PI / 180);
			const dy_m = (npc.lat - state.lat) * 111320;

			const px = dx_m * pixelsPerMeter;
			const py = -dy_m * pixelsPerMeter;

			if (Math.sqrt(px * px + py * py) > radius - 5) return;

			ctx.save();
			ctx.translate(px, py);
			ctx.rotate(npc.heading * Math.PI / 180);

			ctx.fillStyle = '#fff';
			ctx.shadowBlur = 0;
			ctx.beginPath();
			ctx.moveTo(0, -8);
			ctx.lineTo(6, 6);
			ctx.lineTo(0, 3);
			ctx.lineTo(-6, 6);
			ctx.closePath();
			ctx.fill();
			ctx.restore();
		});

		ctx.restore();

		const pad = 12;
		const edgeX = centerX - pad;
		const edgeY = centerY - pad;

		ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.moveTo(0, centerY);
		ctx.lineTo(w, centerY);
		ctx.moveTo(centerX, 0);
		ctx.lineTo(centerX, h);

		const mainViewer = getViewer();
		let halfHFov = Math.PI / 4;
		if (mainViewer && mainViewer.camera && mainViewer.camera.frustum) {
			const fovy = mainViewer.camera.frustum.fovy;
			const aspect = window.innerWidth / window.innerHeight;
			halfHFov = Math.atan(Math.tan(fovy / 2) * aspect);
		}

		const fovLineLen = w + h;
		ctx.moveTo(centerX, centerY);
		ctx.lineTo(centerX - Math.sin(halfHFov) * fovLineLen, centerY - Math.cos(halfHFov) * fovLineLen);
		ctx.moveTo(centerX, centerY);
		ctx.lineTo(centerX + Math.sin(halfHFov) * fovLineLen, centerY - Math.cos(halfHFov) * fovLineLen);
		ctx.stroke();

		ctx.fillStyle = '#0f0';
		ctx.font = `bold 16px ${getComputedStyle(document.body).fontFamily}`;
		ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
		ctx.shadowBlur = 4;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';

		[
			{ label: 'N', angle: 0 },
			{ label: 'E', angle: 90 },
			{ label: 'S', angle: 180 },
			{ label: 'W', angle: 270 }
		].forEach(dir => {
			const relAngle = (dir.angle - heading) * Math.PI / 180;
			const sinA = Math.sin(relAngle);
			const cosA = Math.cos(relAngle);

			const absSin = Math.abs(sinA);
			const absCos = Math.abs(cosA);

			let dx, dy;
			if (edgeX * absCos > edgeY * absSin) {
				dy = (cosA > 0) ? -edgeY : edgeY;
				dx = (dy * sinA) / -cosA;
			} else {
				dx = (sinA > 0) ? edgeX : -edgeX;
				dy = (dx * -cosA) / sinA;
			}

			ctx.fillText(dir.label, centerX + dx, centerY + dy);
		});

		ctx.save();
		ctx.translate(centerX, centerY);
		ctx.fillStyle = '#0f0';
		ctx.shadowBlur = 0;
		ctx.beginPath();
		ctx.moveTo(0, -12);
		ctx.lineTo(8, 10);
		ctx.lineTo(0, 5);
		ctx.lineTo(-8, 10);
		ctx.closePath();
		ctx.fill();

		ctx.strokeStyle = 'rgba(0, 255, 0, 0.7)';
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.arc(0, 0, circleRadius, 0, Math.PI * 2);
		ctx.stroke();

		ctx.restore();

		const sweepTime = (Date.now() / 1500) % 1;
		ctx.strokeStyle = `rgba(0, 255, 0, ${0.7 * (1 - sweepTime)})`;
		ctx.lineWidth = 1.2;
		ctx.beginPath();
		ctx.arc(centerX, centerY, sweepTime * circleRadius, 0, Math.PI * 2);
		ctx.stroke();
	}

	updateNPCMarkers(npcs, playerState) {
		const viewer = getViewer();
		if (!viewer) return;

		const activeIds = new Set();
		if (npcs && npcs.length > 0) {
			this.npcContainer.style.display = 'block';
			const scene = viewer.scene;
			const camera = scene.camera;
			const maxDist = 200000;

			const scratchPos = new Cesium.Cartesian3();
			const scratchPlayerPos = new Cesium.Cartesian3();

			npcs.forEach(npc => {
				Cesium.Cartesian3.fromDegrees(npc.lon, npc.lat, npc.alt, undefined, scratchPos);
				Cesium.Cartesian3.fromDegrees(playerState.lon, playerState.lat, playerState.alt, undefined, scratchPlayerPos);
				const dist = Cesium.Cartesian3.distance(scratchPos, scratchPlayerPos);

				if (dist > maxDist) return;
				const id = npc.id || npc.name;
				activeIds.add(id);

				let marker = this.npcMarkers.get(id);
				if (!marker) {
					marker = this.createNPCMarker(npc);
					this.npcMarkers.set(id, marker);
				}

				const transformFunc = Cesium.SceneTransforms.worldToWindowCoordinates || Cesium.SceneTransforms.wgs84ToWindowCoordinates;
				const windowPos = transformFunc ? transformFunc(scene, scratchPos) : null;

				const direction = Cesium.Cartesian3.subtract(scratchPos, camera.position, new Cesium.Cartesian3());
				const depth = Cesium.Cartesian3.dot(direction, camera.direction);

				const isOffScreen = !windowPos || depth <= 0 ||
					windowPos.x < 0 || windowPos.x > window.innerWidth ||
					windowPos.y < 0 || windowPos.y > window.innerHeight;

				if (isOffScreen) {
					const dx = Cesium.Cartesian3.dot(direction, camera.right);
					const dy = -Cesium.Cartesian3.dot(direction, camera.up);
					this.updateOffScreenMarker(marker, dx, dy, npc, dist);
				} else {
					this.updateOnScreenMarker(marker, windowPos, npc, dist, playerState);
				}
			});
		} else {
			this.npcContainer.style.display = 'none';
		}

		for (const [id, marker] of this.npcMarkers) {
			if (!activeIds.has(id)) {
				marker.container.remove();
				this.npcMarkers.delete(id);
			}
		}
	}

	createNPCMarker(npc) {
		const container = document.createElement('div');
		container.className = 'npc-marker-container';

		const visualWrapper = document.createElement('div');
		visualWrapper.className = 'npc-visual-wrapper';

		const diamond = document.createElement('div');
		diamond.className = 'npc-diamond';

		const lockBox = document.createElement('div');
		lockBox.className = 'npc-lock-box';
		lockBox.style.display = 'none';

		const label = document.createElement('div');
		label.className = 'npc-label';

		const dot = document.createElement('div');
		dot.className = 'npc-offscreen-dot';
		dot.style.display = 'none';

		const offscreenName = document.createElement('div');
		offscreenName.className = 'npc-offscreen-name';
		offscreenName.style.display = 'none';

		visualWrapper.appendChild(diamond);
		visualWrapper.appendChild(lockBox);

		container.appendChild(visualWrapper);
		container.appendChild(label);
		container.appendChild(dot);
		container.appendChild(offscreenName);
		this.npcContainer.appendChild(container);

		return { container, diamond, label, dot, offscreenName, lockBox };
	}

	updateOnScreenMarker(marker, pos, npc, dist, state) {
		marker.container.style.display = 'flex';
		marker.container.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;

		marker.diamond.style.display = 'block';
		marker.label.style.display = 'block';
		marker.dot.style.display = 'none';
		marker.offscreenName.style.display = 'none';

		const ws = state.weaponSystem;
		if (ws && ws.lockingTarget === npc) {
			marker.lockBox.style.display = 'block';
			if (ws.lockStatus === 'LOCKED') {
				marker.lockBox.classList.remove('locking-blink');
				marker.lockBox.style.borderColor = '#0f0';
				marker.lockBox.innerHTML = '<span style="position:absolute; top:-20px; left:50%; transform:translateX(-50%); font-weight:bold; color:#0f0; font-size:12px; text-shadow: 0 0 8px rgba(0, 255, 0, 0.8);">LOCK</span>';
			} else if (ws.lockStatus === 'LOCKING') {
				marker.lockBox.classList.add('locking-blink');
				marker.lockBox.style.borderColor = '#0f0';
				marker.lockBox.innerHTML = '';
			}
		} else {
			marker.lockBox.style.display = 'none';
			marker.lockBox.innerHTML = '';
		}

		const distKm = (dist / 1000).toFixed(1);
		const labelText = `${npc.name}\n${distKm} KM`;
		if (marker.label.innerText !== labelText) {
			marker.label.innerText = labelText;
		}
	}

	updateOffScreenMarker(marker, dx, dy, npc, dist) {
		marker.container.style.display = 'flex';
		marker.diamond.style.display = 'none';
		marker.label.style.display = 'none';
		marker.dot.style.display = 'block';
		marker.offscreenName.style.display = 'block';

		const centerX = window.innerWidth / 2;
		const centerY = window.innerHeight / 2;

		if (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001) dy = -1;

		const angle = Math.atan2(dy, dx);
		const margin = 40;
		const viewW = centerX - margin;
		const viewH = centerY - margin;

		const cosA = Math.cos(angle);
		const sinA = Math.sin(angle);

		let x, y;
		if (Math.abs(viewW * sinA) > Math.abs(viewH * cosA)) {
			y = viewH * Math.sign(sinA);
			x = y * cosA / sinA;
		} else {
			x = viewW * Math.sign(cosA);
			y = x * sinA / cosA;
		}

		const finalX = centerX + x;
		const finalY = centerY + y;
		marker.container.style.transform = `translate3d(${finalX}px, ${finalY}px, 0) translate(-50%, -50%)`;

		if (marker.offscreenName.innerText !== npc.name) {
			marker.offscreenName.innerText = npc.name;
		}

		if (marker.lockBox) {
			marker.lockBox.style.display = 'none';
			marker.lockBox.innerHTML = '';
		}
	}

	updateFPS(fps) {
		if (this.fpsElem) {
			this.fpsElem.innerText = Math.round(fps).toString();
		}
	}

	updateWeapons(weaponSystem) {
		const currentWeapon = weaponSystem.getCurrentWeapon();
		const now = performance.now() * 0.001;

		const isMissileSelected = !!currentWeapon && (
			currentWeapon.id === 'missile' ||
			currentWeapon.id === 'aim-9' ||
			(currentWeapon.name && currentWeapon.name.toLowerCase().includes('aim-9'))
		);
		this.showMissileCrosshair(isMissileSelected);

		['gun', 'missile', 'flare'].forEach(id => {
			const elem = this.weaponElems[id];
			const ammoElem = this.weaponAmmoElems[id];
			const progressElem = this.weaponProgressElems[id];

			const weapon = id === 'flare' ? weaponSystem.flareWeapon : weaponSystem.weapons.find(w => w.id === id && (id !== 'missile' || w === currentWeapon));
			const displayWeapon = weapon || (id === 'flare' ? weaponSystem.flareWeapon : weaponSystem.weapons.find(w => w.id === id));

			if (elem) {
				const isEmptyWarning = weaponSystem.emptyWarningTimers && weaponSystem.emptyWarningTimers[id] > 0;
				const isActive = (currentWeapon && currentWeapon.id === id) ||
					(id === 'flare' && (now - weaponSystem.flareWeapon.lastFire < 1.0)) ||
					isEmptyWarning;
				const isGunOverheated = id === 'gun' && weaponSystem.isGunOverheated;

				if (isActive) {
					elem.classList.add('active');
				} else {
					elem.classList.remove('active');
				}

				if (isGunOverheated || isEmptyWarning) {
					elem.classList.add('overheated');
				} else {
					elem.classList.remove('overheated');
				}

				if (isActive && id === 'missile' && displayWeapon) {
					const nameElem = elem.querySelector('.weapon-name');
					if (nameElem) nameElem.innerText = displayWeapon.name;
				}
			}

			if (progressElem && displayWeapon) {
				let progress = 0;
				if (id === 'gun') {
					progress = weaponSystem.gunHeat * 100;
				} else {
					const timeSinceLast = now - displayWeapon.lastFire;
					const reloadTime = id === 'flare' ? 1.0 : displayWeapon.fireRate;

					if (timeSinceLast < reloadTime) {
						progress = (timeSinceLast / reloadTime) * 100;
					} else {
						progress = 0;
					}
				}
				progressElem.style.width = `${progress}%`;
			}

			if (ammoElem && displayWeapon) {
				if (id === 'gun' && weaponSystem.isGunOverheated) {
					ammoElem.innerText = 'OVERHEAT';
				} else if (displayWeapon.ammo === Infinity) {
					ammoElem.innerText = 'INF';
				} else {
					ammoElem.innerText = displayWeapon.ammo.toString().padStart(2, '0');
				}
			}
		});
	}
}
