import * as THREE from 'three';
import * as Cesium from 'cesium';
import { movePosition } from '../utils/math';
import { particles } from '../utils/particles';
import { soundManager } from '../utils/soundManager';

export class Missile {
	constructor(scene, viewer, startPos, heading, pitch, speed, target = null, onKill = null) {
		this.scene = scene;
		this.viewer = viewer;
		this.target = target;
		this.onKill = onKill;

		this.lon = startPos.lon;
		this.lat = startPos.lat;
		this.alt = startPos.alt;
		this.heading = heading;
		this.pitch = pitch;
		this.roll = 0;
		this.speed = speed + 800;

		this.maxLife = 10;
		this.life = this.maxLife;
		this.active = true;

		this._scratchMatrix = new Cesium.Matrix4();
		this._scratchHPR = new Cesium.HeadingPitchRoll();
		this._scratchCartesian = new Cesium.Cartesian3();
		this._scratchThreeMatrix = new THREE.Matrix4();
		this._scratchCameraMatrix = new Cesium.Matrix4();

		this.trail = [];
		this.distanceSinceLastTrail = 0;

		this.initMesh();
	}

	initMesh() {

		this.mesh = new THREE.Group();


		const bodyLen = 2.6;
		const radius = 0.07;
		const bodyGeom = new THREE.CylinderGeometry(radius, radius, bodyLen, 16);
		const bodyMat = new THREE.MeshStandardMaterial({
			color: 0xcccccc,
			metalness: 0.4,
			roughness: 0.5
		});
		const body = new THREE.Mesh(bodyGeom, bodyMat);
		this.mesh.add(body);

		const noseLen = 0.35;
		const noseGeom = new THREE.ConeGeometry(radius, noseLen, 16);
		noseGeom.translate(0, bodyLen / 2 + noseLen / 2, 0);
		const noseMat = new THREE.MeshStandardMaterial({
			color: 0x333333,
			metalness: 0.8,
			roughness: 0.3
		});
		const nose = new THREE.Mesh(noseGeom, noseMat);
		this.mesh.add(nose);

		const bandGeom = new THREE.CylinderGeometry(radius + 0.001, radius + 0.001, 0.15, 16);
		bandGeom.translate(0, bodyLen / 2 - 0.4, 0);
		const bandMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
		const band = new THREE.Mesh(bandGeom, bandMat);
		this.mesh.add(band);

		const finMat = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.3, roughness: 0.6 });

		const tailFinShape = new THREE.Shape();
		tailFinShape.moveTo(0, 0);
		tailFinShape.lineTo(0.4, -0.2);
		tailFinShape.lineTo(0.4, -0.5);
		tailFinShape.lineTo(0, -0.5);
		tailFinShape.lineTo(0, 0);

		const tailFinGeom = new THREE.ExtrudeGeometry(tailFinShape, { depth: 0.02, bevelEnabled: false });
		tailFinGeom.center();
		tailFinGeom.translate(0.2, -0.25, 0);

		const rearFinGeom = new THREE.BoxGeometry(0.35, 0.4, 0.02);
		rearFinGeom.translate(radius + 0.175, 0, 0);

		for (let i = 0; i < 4; i++) {
			const finGroup = new THREE.Group();
			const finMesh = new THREE.Mesh(rearFinGeom, finMat);
			finGroup.add(finMesh);

			finGroup.position.y = -bodyLen / 2 + 0.3;
			finGroup.rotation.y = i * (Math.PI / 2);


			this.mesh.add(finGroup);
		}

		const frontFinGeom = new THREE.BoxGeometry(0.2, 0.15, 0.015);
		frontFinGeom.translate(radius + 0.1, 0, 0);

		for (let i = 0; i < 4; i++) {
			const finGroup = new THREE.Group();
			const finMesh = new THREE.Mesh(frontFinGeom, finMat);
			finGroup.add(finMesh);
			finGroup.position.y = bodyLen / 2 - 0.6;
			finGroup.rotation.y = i * (Math.PI / 2);
			this.mesh.add(finGroup);
		}

		const flameColor = new THREE.Color(1.0, 0.6, 0.2);

		const flameGeom = new THREE.ConeGeometry(radius * 0.9, 1.0, 16, 1, true);
		flameGeom.rotateX(Math.PI);
		flameGeom.translate(0, -0.5, 0);

		const flameMat = new THREE.MeshBasicMaterial({
			color: flameColor,
			transparent: true,
			opacity: 0.8,
			side: THREE.DoubleSide,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
		this.flameMesh = new THREE.Mesh(flameGeom, flameMat);
		this.flameMesh.position.y = -bodyLen / 2;
		this.mesh.add(this.flameMesh);

		const coreGeom = new THREE.ConeGeometry(radius * 0.5, 0.6, 16, 1, true);
		coreGeom.rotateX(Math.PI);
		coreGeom.translate(0, -0.3, 0);
		const coreMat = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			transparent: true,
			opacity: 0.9,
			side: THREE.DoubleSide,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
		this.flameCore = new THREE.Mesh(coreGeom, coreMat);
		this.flameMesh.add(this.flameCore);

		const canvSize = 128;
		const canv = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
		let glowTexture = null;
		if (canv) {
			canv.width = canv.height = canvSize;
			const ctx = canv.getContext('2d');
			const cx = canvSize / 2;
			const cy = canvSize / 2;
			const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
			grad.addColorStop(0.0, 'rgba(255,255,255,1)');
			grad.addColorStop(0.18, 'rgba(255,245,200,1)');
			grad.addColorStop(0.38, 'rgba(255,160,30,0.95)');
			grad.addColorStop(0.62, 'rgba(220,60,10,0.6)');
			grad.addColorStop(1.0, 'rgba(0,0,0,0)');
			ctx.fillStyle = grad;
			ctx.fillRect(0, 0, canvSize, canvSize);
			glowTexture = new THREE.CanvasTexture(canv);
			glowTexture.minFilter = THREE.LinearFilter;
			glowTexture.magFilter = THREE.LinearFilter;
		}

		const spriteMat = new THREE.SpriteMaterial({
			map: glowTexture,
			color: new THREE.Color(1.0, 0.95, 0.9),
			transparent: true,
			opacity: 0.98,
			blending: THREE.AdditiveBlending,
			depthTest: false,
			depthWrite: false
		});
		this.flameGlow = new THREE.Sprite(spriteMat);
		this.flameGlow.scale.set(2.2, 2.2, 1.0);
		this.flameGlow.position.y = -bodyLen / 2 - 0.08;
		this.mesh.add(this.flameGlow);

		this.mesh.layers.enable(0);
		this.mesh.layers.enable(1);

		this.mesh.matrixAutoUpdate = false;
		this.scene.add(this.mesh);
	}

	update(dt, npcs) {
		if (!this.active) {
			if (this.trail.length > 0) {
				this.updateTrail(dt);
			}
			return;
		}

		if (this.flameMesh) {
			const flicker = 0.8 + Math.random() * 0.4;
			const flickerLen = 0.9 + Math.random() * 0.2;

			this.flameMesh.scale.set(flicker, flickerLen, flicker);
			this.flameMesh.material.opacity = 0.7 + Math.random() * 0.3;

			if (this.flameCore) {
				this.flameCore.scale.set(flicker, flickerLen, flicker);
			}
		}

		this.life -= dt;
		if (this.life <= 0) {
			this.destroy();
			return;
		}

		if (this.target && !this.target.destroyed) {
			this.trackTarget(dt);
		}

		const newPos = movePosition(this.lon, this.lat, this.alt, this.heading, this.pitch, this.speed * dt);
		this.lon = newPos.lon;
		this.lat = newPos.lat;
		this.alt = newPos.alt;

		this.updateTrail(dt);
		this.updateThreeMatrix();

		if (npcs) {
			for (const npc of npcs) {
				const distSq = this.calculateDistSqToNPC(npc);
				if (distSq < 10000) {
					this.hitNPC(npc);
					return;
				}
			}
		}

		this.checkTerrainCollision();
	}

	trackTarget(dt) {
		const targetPos = Cesium.Cartesian3.fromDegrees(this.target.lon, this.target.lat, this.target.alt);
		const myPos = Cesium.Cartesian3.fromDegrees(this.lon, this.lat, this.alt);

		const direction = Cesium.Cartesian3.subtract(targetPos, myPos, new Cesium.Cartesian3());
		Cesium.Cartesian3.normalize(direction, direction);

		const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(myPos);
		const invEnu = Cesium.Matrix4.inverse(enuMatrix, new Cesium.Matrix4());
		const localDir = Cesium.Matrix4.multiplyByPointAsVector(invEnu, direction, new Cesium.Cartesian3());

		const targetHeading = Cesium.Math.toDegrees(Math.atan2(localDir.x, localDir.y));
		const targetPitch = Cesium.Math.toDegrees(Math.asin(localDir.z));

		let headingDiff = targetHeading - this.heading;
		while (headingDiff < -180) headingDiff += 360;
		while (headingDiff > 180) headingDiff -= 360;

		const turnRate = 90;
		this.heading += Math.max(-turnRate * dt, Math.min(turnRate * dt, headingDiff));
		this.pitch += Math.max(-turnRate * dt, Math.min(turnRate * dt, targetPitch - this.pitch));
	}

	updateTrail(dt) {
		if (this.active) {
			this.distanceSinceLastTrail += this.speed * dt;
			const spawnInterval = 20.0;
			while (this.distanceSinceLastTrail >= spawnInterval) {
				const backDist = this.distanceSinceLastTrail - spawnInterval;
				const spawnPos = movePosition(this.lon, this.lat, this.alt, this.heading, this.pitch, -backDist);

				this.distanceSinceLastTrail -= spawnInterval;

				const smokeGeom = new THREE.SphereGeometry(1.0, 16, 16);
				const gray = 0.5 + Math.random() * 0.75;
				const smokeMat = new THREE.MeshBasicMaterial({
					color: new THREE.Color(gray, gray, gray),
					transparent: true,
					opacity: 0.6 + Math.random() * 0.25
				});
				const smoke = new THREE.Mesh(smokeGeom, smokeMat);
				smoke.lon = spawnPos.lon;
				smoke.lat = spawnPos.lat;
				smoke.alt = spawnPos.alt;
				smoke.life = 4.0;
				smoke.maxLife = 4.0;

				const age = this.maxLife - this.life;
				smoke.launchScale = Math.min(1.0, 0.25 + (age / 1.5) * 0.75);

				smoke.matrixAutoUpdate = false;

				this.scene.add(smoke);
				this.trail.push(smoke);
			}
		}

		const viewMatrix = this.viewer.camera.viewMatrix;
		for (let i = this.trail.length - 1; i >= 0; i--) {
			const t = this.trail[i];
			t.life -= dt;
			if (t.life <= 0) {
				this.scene.remove(t);
				this.trail.splice(i, 1);
				continue;
			}

			if (!t.randomScale) t.randomScale = 0.8 + Math.random() * 0.5;
			const launchScale = t.launchScale || 1.0;
			const scale = launchScale * t.randomScale * (1.0 + (1.0 - t.life / t.maxLife) * 15.0);
			t.scale.set(scale, scale, scale);

			const opacity = (t.life / t.maxLife) * 0.5;
			t.material.opacity = opacity;

			const pos = Cesium.Cartesian3.fromDegrees(t.lon, t.lat, t.alt, undefined, this._scratchCartesian);
			const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos, undefined, this._scratchMatrix);
			const cameraSpaceMatrix = Cesium.Matrix4.multiply(viewMatrix, modelMatrix, this._scratchCameraMatrix);

			for (let j = 0; j < 16; j++) {
				this._scratchThreeMatrix.elements[j] = cameraSpaceMatrix[j];
			}

			t.matrix.copy(this._scratchThreeMatrix);
			t.matrix.scale(new THREE.Vector3(scale, scale, scale));
			t.updateMatrixWorld(true);
		}
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

		const worldUp = new Cesium.Cartesian3();
		Cesium.Cartesian3.cross(worldRight, worldForward, worldUp);

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

		if (this.flameGlow && this.viewer && this.viewer.camera && this.viewer.camera.position) {
			try {
				const camPos = this.viewer.camera.position;
				const dist = Cesium.Cartesian3.distance(pos, camPos) || 1.0;
				const s = THREE.MathUtils.clamp(dist * 0.0016, 1.0, 80.0);
				this.flameGlow.scale.set(s, s, 1.0);
				this.flameGlow.renderOrder = 9999;
				if (this.flameGlow.material) this.flameGlow.material.opacity = Math.max(0.25, Math.min(1.0, 80.0 / s));
			} catch (e) { }
		}
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
			particles.spawnExplosion(this.lon, this.lat, this.alt, { count: 80, smokeCount: 18, big: true });
			particles.spawnWreckage(this.lon, this.lat, this.alt, this.heading, this.pitch, { count: 48 });
			soundManager.play('explosion-random');
		} catch (e) { }
		this.destroy();
	}

	checkTerrainCollision() {
		const cartographic = Cesium.Cartographic.fromDegrees(this.lon, this.lat);
		const terrainHeight = this.viewer.scene.globe.getHeight(cartographic);
		if (terrainHeight !== undefined && this.alt < terrainHeight) {
			try {
				particles.spawnExplosion(this.lon, this.lat, this.alt, { count: 80, smokeCount: 18, big: true });
				particles.spawnWreckage(this.lon, this.lat, this.alt, this.heading, this.pitch, { count: 48 });
				soundManager.play('explosion-random');
			} catch (e) { }
			this.destroy();
		}
	}

	destroy() {
		this.active = false;
		if (this.mesh) {
			this.scene.remove(this.mesh);
		}
	}
}
