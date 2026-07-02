import * as THREE from 'three';
import * as Cesium from 'cesium';

export class Flare {
	constructor(scene, viewer, startPos, heading, pitch, speed) {
		this.scene = scene;
		this.viewer = viewer;

		this.lon = startPos.lon;
		this.lat = startPos.lat;
		this.alt = startPos.alt;

		this.heading = (heading + 180 + (Math.random() - 0.5) * 40);
		this.pitch = (pitch - 15 - Math.random() * 20);
		this.speed = speed * 0.5;
		this.gravity = 5.0;
		this.verticalVelocity = 0;

		this.life = 4.0;
		this.maxLife = 4.0;
		this.active = true;

		this._scratchCartesian = new Cesium.Cartesian3();
		this._scratchMatrix = new Cesium.Matrix4();
		this._scratchCameraMatrix = new Cesium.Matrix4();
		this._scratchThreeMatrix = new THREE.Matrix4();

		this.trail = [];
		this.distanceSinceLastTrail = 0;

		this.initMesh();
	}

	initMesh() {
		this.group = new THREE.Group();
		this.group.matrixAutoUpdate = false;

		const coreSize = 64;
		const canvas = document.createElement('canvas');
		canvas.width = coreSize;
		canvas.height = coreSize;
		const ctx = canvas.getContext('2d');
		const grad = ctx.createRadialGradient(coreSize / 2, coreSize / 2, 0, coreSize / 2, coreSize / 2, coreSize / 2);
		grad.addColorStop(0, '#ffffff');
		grad.addColorStop(0.2, '#ffff66');
		grad.addColorStop(0.5, '#ffff00');
		grad.addColorStop(1, 'rgba(0,0,0,0)');
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, coreSize, coreSize);
		const flareTexture = new THREE.CanvasTexture(canvas);

		const flareMat = new THREE.SpriteMaterial({
			map: flareTexture,
			color: 0xffff44,
			transparent: true,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});

		this.flareSprite = new THREE.Sprite(flareMat);
		this.flareSprite.scale.set(1.5, 1.5, 1.0);
		this.group.add(this.flareSprite);

		const glowMat = new THREE.SpriteMaterial({
			map: flareTexture,
			color: 0xffaa00,
			transparent: true,
			opacity: 0.8,
			blending: THREE.AdditiveBlending,
			depthWrite: false
		});
		this.glowSprite = new THREE.Sprite(glowMat);
		this.glowSprite.scale.set(4.0, 4.0, 1.0);
		this.group.add(this.glowSprite);

		this.scene.add(this.group);
	}

	update(dt) {
		if (!this.active) return;

		this.life -= dt;
		if (this.life <= 0) {
			this.destroy();
			return;
		}

		const moveDist = this.speed * dt;
		const newPos = this.calculateMove(moveDist);
		this.lon = newPos.lon;
		this.lat = newPos.lat;
		this.alt = newPos.alt;

		this.verticalVelocity -= this.gravity * dt;
		this.alt += this.verticalVelocity * dt;

		this.speed *= 0.98;

		this.updateThreeMatrix();
		this._spawnTrailIfNeeded(dt);
		this._updateTrail(dt);

		const t = this.life / this.maxLife;
		if (this.flareSprite) {
			this.flareSprite.material.opacity = Math.min(1.0, t * 1.5);
			const flicker = 0.9 + Math.random() * 0.2;
			this.flareSprite.scale.set(1.5 * flicker, 1.5 * flicker, 1.0);
		}
		if (this.glowSprite) {
			this.glowSprite.material.opacity = Math.min(0.8, t * 1.2);
			const flicker = 0.8 + Math.random() * 0.4;
			this.glowSprite.scale.set(4.0 * flicker, 4.0 * flicker, 1.0);
		}
	}

	calculateMove(dist) {
		const radH = Cesium.Math.toRadians(this.heading);
		const radP = Cesium.Math.toRadians(this.pitch);
		const R = 6371000;
		const dLat = (dist * Math.cos(radH) * Math.cos(radP)) / R;
		const dLon = (dist * Math.sin(radH) * Math.cos(radP)) / (R * Math.cos(Cesium.Math.toRadians(this.lat)));
		const dAlt = dist * Math.sin(radP);
		return {
			lon: this.lon + Cesium.Math.toDegrees(dLon),
			lat: this.lat + Cesium.Math.toDegrees(dLat),
			alt: this.alt + dAlt
		};
	}

	updateThreeMatrix() {
		const viewMatrix = this.viewer.camera.viewMatrix;
		const pos = Cesium.Cartesian3.fromDegrees(this.lon, this.lat, this.alt);
		const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos, undefined, this._scratchMatrix);

		const cameraSpaceMatrix = Cesium.Matrix4.multiply(viewMatrix, enuMatrix, this._scratchCameraMatrix);
		for (let j = 0; j < 16; j++) this._scratchThreeMatrix.elements[j] = cameraSpaceMatrix[j];
		this.group.matrix.copy(this._scratchThreeMatrix);
		this.group.updateMatrixWorld(true);
	}

	_spawnTrailIfNeeded(dt) {
		this.distanceSinceLastTrail += (this.speed + Math.abs(this.verticalVelocity)) * dt;
		const spawnInterval = 3.0;

		while (this.distanceSinceLastTrail >= spawnInterval) {
			const backDist = this.distanceSinceLastTrail - spawnInterval;
			const ratio = backDist / ((this.speed + Math.abs(this.verticalVelocity)) * dt || 1);

			const spawnLon = this.lon;
			const spawnLat = this.lat;
			const spawnAlt = this.alt - this.verticalVelocity * dt * ratio;

			this.distanceSinceLastTrail -= spawnInterval;

			const smokeGeom = new THREE.SphereGeometry(1.0, 12, 12);
			const gray = 0.4 + Math.random() * 0.4;
			const smokeMat = new THREE.MeshBasicMaterial({
				color: new THREE.Color(gray, gray, gray),
				transparent: true,
				opacity: 0.5 + Math.random() * 0.2
			});
			const smoke = new THREE.Mesh(smokeGeom, smokeMat);
			smoke.lon = spawnLon;
			smoke.lat = spawnLat;
			smoke.alt = spawnAlt;
			smoke.life = 2.0 + Math.random() * 1.5;
			smoke.maxLife = smoke.life;
			smoke.matrixAutoUpdate = false;

			this.scene.add(smoke);
			this.trail.push(smoke);
		}
	}

	_updateTrail(dt) {
		const viewMatrix = this.viewer.camera.viewMatrix;
		for (let i = this.trail.length - 1; i >= 0; i--) {
			const t = this.trail[i];
			t.life -= dt;
			if (t.life <= 0) {
				this.scene.remove(t);
				this.trail.splice(i, 1);
				continue;
			}

			if (!t.randomScale) t.randomScale = 0.5 + Math.random() * 0.5;
			const lifeRatio = t.life / t.maxLife;
			const scale = t.randomScale * (1.0 + (1.0 - lifeRatio) * 8.0);
			t.scale.set(scale, scale, scale);

			t.material.opacity = lifeRatio * 0.4;

			const pos = Cesium.Cartesian3.fromDegrees(t.lon, t.lat, t.alt, undefined, this._scratchCartesian);
			const modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(pos, undefined, this._scratchMatrix);
			const cameraSpaceMatrix = Cesium.Matrix4.multiply(viewMatrix, modelMatrix, this._scratchCameraMatrix);

			for (let j = 0; j < 16; j++) {
				this._scratchThreeMatrix.elements[j] = cameraSpaceMatrix[j];
			}

			t.matrix.copy(this._scratchThreeMatrix);
			t.matrix.scale(new THREE.Vector3(scale, scale, scale));
			t.updateMatrixWorld(true);

			t.alt += 0.5 * dt;
		}
	}

	destroy() {
		this.active = false;
		if (this.group) {
			this.scene.remove(this.group);
		}
		for (const t of this.trail) {
			this.scene.remove(t);
		}
		this.trail = [];
	}
}
