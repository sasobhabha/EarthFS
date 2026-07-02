import * as THREE from 'three';
import * as Cesium from 'cesium';
import { movePosition } from '../utils/math';
import { particles } from '../utils/particles';
import { soundManager } from '../utils/soundManager';

export class Bullet {
	constructor(scene, viewer, startPos, heading, pitch, speed, onKill = null) {
		this.scene = scene;
		this.viewer = viewer;
		this.onKill = onKill;

		this.lon = startPos.lon;
		this.lat = startPos.lat;
		this.alt = startPos.alt;
		this.heading = heading;
		this.pitch = pitch;
		this.speed = speed + 1500;

		this.life = 3;
		this.active = true;

		this._scratchMatrix = new Cesium.Matrix4();
		this._scratchCartesian = new Cesium.Cartesian3();
		this._scratchThreeMatrix = new THREE.Matrix4();
		this._scratchCameraMatrix = new Cesium.Matrix4();

		this.initMesh();
	}

	initMesh() {
		const createGradientMaterial = (width, opacity, intensity) => {
			return new THREE.ShaderMaterial({
				uniforms: {
					colorStart: { value: new THREE.Color(0xff3300) },
					colorMid: { value: new THREE.Color(0xffcc00) },
					colorEnd: { value: new THREE.Color(0xffffff) },
					opacity: { value: opacity },
					intensity: { value: intensity }
				},
				vertexShader: `
					varying vec2 vUv;
					void main() {
						vUv = uv;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`,
				fragmentShader: `
					uniform vec3 colorStart;
					uniform vec3 colorMid;
					uniform vec3 colorEnd;
					uniform float opacity;
					uniform float intensity;
					varying vec2 vUv;
					void main() {
						float t = clamp(vUv.y, 0.0, 1.0);
						vec3 a = mix(colorStart, colorMid, smoothstep(0.0, 0.5, t));
						vec3 b = mix(colorMid, colorEnd, smoothstep(0.5, 1.0, t));
						vec3 col = mix(a, b, smoothstep(0.0, 1.0, t));
						float alpha = opacity * pow(t, 0.6) * intensity;
						float edge = 1.0 - smoothstep(0.0, 0.5, abs(vUv.x - 0.5) * 2.0);
						alpha *= edge;
						gl_FragColor = vec4(col, alpha);
					}
				`,
				transparent: true,
				depthWrite: false,
				blending: THREE.AdditiveBlending,
				side: THREE.DoubleSide
			});
		};

		const mainLen = 20;

		this.mesh = new THREE.Group();

		const createPlaneMesh = (width, len, opacity, intensity) => {
			const geom = new THREE.PlaneGeometry(width, len, 1, 1);
			geom.translate(0, -len / 2, 0);
			const mat = createGradientMaterial(width, opacity, intensity);
			return new THREE.Mesh(geom, mat);
		};

		for (let i = 0; i < 3; i++) {
			const p = createPlaneMesh(0.6, mainLen, 1.0, 1.0);
			p.rotateY((i * Math.PI * 2) / 3);
			this.mesh.add(p);
		}

		for (let i = 0; i < 3; i++) {
			const g = createPlaneMesh(1.6, mainLen * 1.1, 0.35, 0.65);
			g.rotateY((i * Math.PI * 2) / 3 + Math.PI / 6);
			this.mesh.add(g);
		}

		const tipGeom = new THREE.ConeGeometry(0.12, 0.8, 12);
		tipGeom.translate(0, -0.4, 0);
		const tipMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false });
		const tip = new THREE.Mesh(tipGeom, tipMat);
		this.mesh.add(tip);

		this.mesh.matrixAutoUpdate = false;
		this.scene.add(this.mesh);
	}

	update(dt, npcs) {
		if (!this.active) return;

		this.life -= dt;
		if (this.life <= 0) {
			this.destroy();
			return;
		}

		const newPos = movePosition(this.lon, this.lat, this.alt, this.heading, this.pitch, this.speed * dt);
		this.lon = newPos.lon;
		this.lat = newPos.lat;
		this.alt = newPos.alt;

		this.updateThreeMatrix();

		if (npcs) {
			for (const npc of npcs) {
				const distSq = this.calculateDistSqToNPC(npc);
				if (distSq < 400) {
					this.hitNPC(npc);
					return;
				}
			}
		}
		this.checkTerrainCollision();
	}

	updateThreeMatrix() {
		const viewMatrix = this.viewer.camera.viewMatrix;
		const pos = Cesium.Cartesian3.fromDegrees(this.lon, this.lat, this.alt, undefined, this._scratchCartesian);
		const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos, undefined, this._scratchMatrix);

		const hRad = Cesium.Math.toRadians(this.heading);
		const pRad = Cesium.Math.toRadians(this.pitch);

		const localForward = new Cesium.Cartesian3(
			Math.sin(hRad) * Math.cos(pRad),
			Math.cos(hRad) * Math.cos(pRad),
			Math.sin(pRad)
		);

		const worldForward = Cesium.Matrix4.multiplyByPointAsVector(enuMatrix, localForward, new Cesium.Cartesian3());
		Cesium.Cartesian3.normalize(worldForward, worldForward);
		const enuUp = new Cesium.Cartesian3(enuMatrix[8], enuMatrix[9], enuMatrix[10]);

		let worldRight = new Cesium.Cartesian3();
		if (Math.abs(Cesium.Cartesian3.dot(worldForward, enuUp)) > 0.999) {
			const enuNorth = new Cesium.Cartesian3(enuMatrix[4], enuMatrix[5], enuMatrix[6]);
			Cesium.Cartesian3.cross(worldForward, enuNorth, worldRight);
		} else {
			Cesium.Cartesian3.cross(worldForward, enuUp, worldRight);
		}
		Cesium.Cartesian3.normalize(worldRight, worldRight);
		const worldUp = Cesium.Cartesian3.cross(worldRight, worldForward, new Cesium.Cartesian3());

		const finalModelMatrix = this._scratchMatrix;
		finalModelMatrix[0] = worldRight.x; finalModelMatrix[1] = worldRight.y; finalModelMatrix[2] = worldRight.z; finalModelMatrix[3] = 0;
		finalModelMatrix[4] = worldForward.x; finalModelMatrix[5] = worldForward.y; finalModelMatrix[6] = worldForward.z; finalModelMatrix[7] = 0;
		finalModelMatrix[8] = worldUp.x; finalModelMatrix[9] = worldUp.y; finalModelMatrix[10] = worldUp.z; finalModelMatrix[11] = 0;
		finalModelMatrix[12] = pos.x; finalModelMatrix[13] = pos.y; finalModelMatrix[14] = pos.z; finalModelMatrix[15] = 1;

		const cameraSpaceMatrix = Cesium.Matrix4.multiply(viewMatrix, finalModelMatrix, this._scratchCameraMatrix);
		for (let i = 0; i < 16; i++) {
			this._scratchThreeMatrix.elements[i] = cameraSpaceMatrix[i];
		}
		this.mesh.matrix.copy(this._scratchThreeMatrix);
		this.mesh.updateMatrixWorld(true);
	}

	calculateDistSqToNPC(npc) {
		const dLon = (npc.lon - this.lon) * 111320 * Math.cos(Cesium.Math.toRadians(this.lat));
		const dLat = (npc.lat - this.lat) * 111320;
		const dAlt = npc.alt - this.alt;
		return dLon * dLon + dLat * dLat + dAlt * dAlt;
	}

	hitNPC(npc) {
		npc.destroyed = true;
		if (this.onKill) this.onKill(npc);
		try {
			particles.spawnExplosion(this.lon, this.lat, this.alt, { count: 36, smokeCount: 8, big: true });
			particles.spawnWreckage(this.lon, this.lat, this.alt, this.heading, this.pitch, { count: 18 });
			try { soundManager.play('explosion-random'); } catch (e) { }
		} catch (e) { }
		this.destroy();
	}

	checkTerrainCollision() {
		const cartographic = Cesium.Cartographic.fromDegrees(this.lon, this.lat);
		const terrainHeight = this.viewer.scene.globe.getHeight(cartographic);
		if (terrainHeight !== undefined && this.alt < terrainHeight) {
			try { particles.spawnSpark(this.lon, this.lat, this.alt, { count: 10 }); } catch (e) { }
			this.destroy();
		}
	}

	destroy() {
		this.active = false;
		this.scene.remove(this.mesh);
	}
}
