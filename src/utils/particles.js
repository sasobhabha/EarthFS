import * as THREE from 'three';
import * as Cesium from 'cesium';

const particles = {
	scene: null,
	viewer: null,
	list: [],
	_scratchMatrix: new Cesium.Matrix4(),
	_scratchCameraMatrix: new Cesium.Matrix4(),
	_scratchThreeMatrix: new THREE.Matrix4(),

	init(scene, viewer) {
		this.scene = scene;
		this.viewer = viewer;
	},

	spawnExplosion(lon, lat, alt, opts = {}) {
		const isBig = !!opts.big;
		const fireCount = opts.count || (isBig ? 64 : 36);

		const flashSize = isBig ? 6.0 : 3.0;
		const flashGeom = new THREE.SphereGeometry(flashSize, 12, 10);
		const flashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending, transparent: true, opacity: 1.0 });
		const flash = new THREE.Mesh(flashGeom, flashMat);
		flash.life = 0.18 + Math.random() * 0.12;
		flash.maxLife = flash.life;
		flash.lon = lon; flash.lat = lat; flash.alt = alt;
		flash.isSmoke = false;
		flash._expand = true; flash._expandAmount = isBig ? 5.0 : 3.0;
		flash.matrixAutoUpdate = false;
		this.scene.add(flash);
		this.list.push(flash);

		for (let i = 0; i < fireCount; i++) {
			const size = (isBig ? 0.6 : 0.35) + Math.random() * (isBig ? 2.4 : 0.9);
			const geom = new THREE.SphereGeometry(size, 8, 6);
			const color = new THREE.Color().setHSL(0.08 - Math.random() * 0.05, 1.0, 0.5 + Math.random() * 0.2);
			const mat = new THREE.MeshBasicMaterial({ color: color, blending: THREE.AdditiveBlending, transparent: true, opacity: 1.0 });
			const m = new THREE.Mesh(geom, mat);
			m.life = (isBig ? 0.9 : 0.6) + Math.random() * (isBig ? 1.4 : 0.8);
			m.maxLife = m.life;
			m.lon = lon; m.lat = lat; m.alt = alt;
			const h = Math.random() * Math.PI * 2;
			const p = (Math.random() * 120 - 60) * (Math.PI / 180);
			const speed = (isBig ? 18 : 10) + Math.random() * (isBig ? 60 : 36);
			m._localVel = {
				east: Math.sin(h) * Math.cos(p) * speed,
				north: Math.cos(h) * Math.cos(p) * speed,
				up: Math.sin(p) * speed
			};
			m.isSmoke = false;
			m._expand = true; m._expandAmount = isBig ? 2.8 : 1.8;
			m.matrixAutoUpdate = false;
			this.scene.add(m);
			this.list.push(m);
		}

		const sparkCount = isBig ? 32 : 18;
		for (let i = 0; i < sparkCount; i++) {
			const geom = new THREE.SphereGeometry(0.06 + Math.random() * 0.14, 6, 6);
			const mat = new THREE.MeshBasicMaterial({ color: 0xffffcc, blending: THREE.AdditiveBlending, transparent: true });
			const m = new THREE.Mesh(geom, mat);
			m.life = 0.18 + Math.random() * 0.36;
			m.maxLife = m.life;
			m.lon = lon; m.lat = lat; m.alt = alt;
			const h = Math.random() * Math.PI * 2;
			const p = (Math.random() * 120 - 60) * (Math.PI / 180);
			const speed = (isBig ? 36 : 18) + Math.random() * (isBig ? 120 : 60);
			m._localVel = {
				east: Math.sin(h) * Math.cos(p) * speed,
				north: Math.cos(h) * Math.cos(p) * speed,
				up: Math.sin(p) * speed
			};
			m.isSmoke = false;
			m._expand = true; m._expandAmount = 0.6;
			m.matrixAutoUpdate = false;
			this.scene.add(m);
			this.list.push(m);
		}

		const smokeCount = typeof opts.smokeCount !== 'undefined' ? opts.smokeCount : (isBig ? 8 : 5);
		for (let i = 0; i < smokeCount; i++) {
			const size = (isBig ? 3.0 : 1.8) + Math.random() * (isBig ? 4.0 : 1.6);
			const geom = new THREE.SphereGeometry(size, 12, 10);
			const gray = 0.08 + Math.random() * 0.3;
			const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(gray, gray, gray), transparent: true, opacity: 0.75 });
			const m = new THREE.Mesh(geom, mat);
			m.life = (isBig ? 1.0 : 0.6) + Math.random() * (isBig ? 1.2 : 0.6);
			m.maxLife = m.life;
			m.lon = lon + (Math.random() - 0.5) * 0.00018;
			m.lat = lat + (Math.random() - 0.5) * 0.00018;
			m.alt = alt - 0.6 + (Math.random() - 0.5) * 0.8;
			m._localVel = {
				east: (Math.random() - 0.5) * 2.2,
				north: (Math.random() - 0.5) * 2.2,
				up: 0.6 + Math.random() * 2.6
			};
			m.isSmoke = true;
			m.matrixAutoUpdate = false;
			this.scene.add(m);
			this.list.push(m);
		}

		try { if (this.viewer) this.viewer.scene && this.viewer.scene.requestRender(); } catch (e) { }
	},

	spawnWreckage(lon, lat, alt, heading = 0, pitch = 0, opts = {}) {
		const count = opts.count || 30;
		const hRad = Cesium.Math.toRadians(heading);
		const pRad = Cesium.Math.toRadians(pitch);
		const forward = {
			east: Math.sin(hRad) * Math.cos(pRad),
			north: Math.cos(hRad) * Math.cos(pRad),
			up: Math.sin(pRad)
		};
		for (let i = 0; i < count; i++) {
			const shapeType = Math.random();
			let geom;
			const size = 0.4 + Math.random() * 2.4;
			if (shapeType < 0.6) {
				const points = [];
				const numPoints = 3 + Math.floor(Math.random() * 3);
				const radius = size;
				for (let k = 0; k < numPoints; k++) {
					const ang = (k / numPoints) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
					const r = radius * (0.35 + Math.random() * 1.1);
					points.push(new THREE.Vector2(Math.cos(ang) * r, Math.sin(ang) * r));
				}
				const shape = new THREE.Shape(points);
				const depth = Math.max(0.03, size * 0.12);
				const extrudeSettings = { depth: depth, bevelEnabled: false };
				geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
				geom.translate(0, 0, -depth * 0.5);
			} else {
				geom = new THREE.ConeGeometry(size * 0.6, size, 3);
				geom.rotateX(Math.PI / 2);
			}
			const gray = 0.0 + Math.random() * 0.06;
			const mat = new THREE.MeshPhongMaterial({ color: new THREE.Color(gray, gray, gray), flatShading: true, side: THREE.DoubleSide });
			const m = new THREE.Mesh(geom, mat);
			m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
			m.scale.set(1.0 + Math.random() * 1.5, 1.0 + Math.random() * 1.5, 1.0 + Math.random() * 1.5);
			m._rotEuler = new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
			m._rotVel = new THREE.Vector3((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6);
			m.life = 4.0 + Math.random() * 8.0;
			m.maxLife = m.life;
			m.lon = lon + (Math.random() - 0.5) * 0.0001;
			m.lat = lat + (Math.random() - 0.5) * 0.0001;
			m.alt = alt + (Math.random() - 0.5) * 1.0;

			const spread = 1.2;
			const speed = 10 + Math.random() * 60;
			m._localVel = {
				east: (forward.east + (Math.random() - 0.5) * spread) * speed,
				north: (forward.north + (Math.random() - 0.5) * spread) * speed,
				up: (forward.up + (Math.random() - 0.5) * spread * 0.8) * speed
			};
			m._localVel.up -= (4 + Math.random() * 6);
			m._fallGravityMultiplier = opts.fallMultiplier || 2.2;
			m.isSmoke = false;
			m.matrixAutoUpdate = false;
			this.scene.add(m);
			this.list.push(m);
		}
	},

	spawnSpark(lon, lat, alt, opts = {}) {
		const count = opts.count || 12;
		for (let i = 0; i < count; i++) {
			const geom = new THREE.SphereGeometry(0.08 + Math.random() * 0.12, 6, 6);
			const mat = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true });
			const m = new THREE.Mesh(geom, mat);
			m.life = 0.18 + Math.random() * 0.36;
			m.maxLife = m.life;
			m.lon = lon;
			m.lat = lat;
			m.alt = alt;
			const h = Math.random() * Math.PI * 2;
			const p = (Math.random() * 120 - 60) * (Math.PI / 180);
			const speed = 18 + Math.random() * 40;
			m._localVel = {
				east: Math.sin(h) * Math.cos(p) * speed,
				north: Math.cos(h) * Math.cos(p) * speed,
				up: Math.sin(p) * speed
			};
			m.isSmoke = false;
			m.matrixAutoUpdate = false;
			this.scene.add(m);
			this.list.push(m);
		}
	},

	update(dt) {
		if (!this.viewer) return;
		const viewMatrix = this.viewer.camera.viewMatrix;
		for (let i = this.list.length - 1; i >= 0; i--) {
			const p = this.list[i];
			p.life -= dt * (p.isSmoke ? 1.1 : 1.0);
			if (p.life <= 0) {
				this.scene.remove(p);
				this.list.splice(i, 1);
				continue;
			}

			const fallMult = p.isSmoke ? 0.2 : (p._fallGravityMultiplier || 1.0);
			p._localVel.up -= 9.81 * dt * fallMult;

			if (p._rotEuler && p._rotVel) {
				p._rotEuler.x += p._rotVel.x * dt;
				p._rotEuler.y += p._rotVel.y * dt;
				p._rotEuler.z += p._rotVel.z * dt;
			}

			const latRad = Cesium.Math.toRadians(p.lat);
			const dLon = (p._localVel.east * dt) / (111320 * Math.cos(latRad));
			const dLat = (p._localVel.north * dt) / 111320;
			const dAlt = p._localVel.up * dt;

			p.lon += dLon;
			p.lat += dLat;
			p.alt += dAlt;

			const t = p.life / p.maxLife;
			if (p.material && p.material.opacity !== undefined) {
				if (p.isSmoke) {
					p.material.opacity = Math.max(0, t * 0.85);
				} else p.material.opacity = Math.max(0, t);
			}
			if (p._expand) {
				const grow = 1.0 + (1.0 - t) * (p._expandAmount || 1.0);
				if (!p.scale) p.scale = new THREE.Vector3(1, 1, 1);
				p.scale.set(grow, grow, grow);
			}
			if (p.isSmoke) {
				const grow = 1.0 + (1.0 - t) * 2.0;
				p.scale.set(grow, grow, grow);
			}

			const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.alt, undefined, new Cesium.Cartesian3());
			const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos, undefined, this._scratchMatrix);
			const cameraSpaceMatrix = Cesium.Matrix4.multiply(viewMatrix, modelMatrix, this._scratchCameraMatrix);

			for (let j = 0; j < 16; j++) this._scratchThreeMatrix.elements[j] = cameraSpaceMatrix[j];

			p.matrix.copy(this._scratchThreeMatrix);
			if (p._rotEuler) {
				const rotScale = new THREE.Matrix4();
				const q = new THREE.Quaternion().setFromEuler(p._rotEuler);
				const s = p.scale ? p.scale.clone() : new THREE.Vector3(1, 1, 1);
				rotScale.compose(new THREE.Vector3(0, 0, 0), q, s);
				p.matrix.multiply(rotScale);
			} else if (p.scale && (p.scale.x !== 1 || p.scale.y !== 1 || p.scale.z !== 1)) {
				p.matrix.scale(p.scale);
			}
			p.updateMatrixWorld(true);
		}
	}
};

export { particles };
