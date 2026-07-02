import * as THREE from 'three';
import * as Cesium from 'cesium';
import { movePosition } from '../utils/math';

export class NPCSystem {
	constructor(viewer, scene, loader) {
		this.viewer = viewer;
		this.scene = scene;
		this.loader = loader;
		this.npcs = [];
		this.npcNames = ['PHOENIX', 'MARVEL', 'VIPER', 'GHOST', 'RAVEN', 'EAGLE', 'FALCON', 'BLADE', 'STRIKER', 'STORM', 'KNIGHT', 'TITAN'];
		this.lastSpawnTime = 0;
		this.modelTemplate = null;
		this.animations = [];
		this.loaded = false;

		this._scratchMatrix = new Cesium.Matrix4();
		this._scratchHPR = new Cesium.HeadingPitchRoll();
		this._scratchCartesian = new Cesium.Cartesian3();
		this._scratchThreeMatrix = new THREE.Matrix4();
		this._scratchCameraMatrix = new Cesium.Matrix4();

		this.loadModel();
	}

	loadModel() {
		this.loader.load('/assets/models/f-15.glb', (gltf) => {
			this.modelTemplate = gltf.scene;
			this.animations = gltf.animations;
			this.modelTemplate.traverse((child) => {
				if (child.isMesh) {
					child.castShadow = true;
					child.receiveShadow = true;
				}
			});
			this.loaded = true;
		});
	}

	spawnNPC(playerLon, playerLat, playerAlt) {
		if (!this.loaded) return null;

		const angle = Math.random() * Math.PI * 2;
		const dist = 5000 + Math.random() * 15000;

		const lonOffset = (dist * Math.cos(angle)) / (111320 * Math.cos(Cesium.Math.toRadians(playerLat)));
		const latOffset = (dist * Math.sin(angle)) / 111320;

		const name = this.npcNames[Math.floor(Math.random() * this.npcNames.length)] + ' ' + (100 + Math.floor(Math.random() * 900));

		const lon = playerLon + lonOffset;
		const lat = playerLat + latOffset;
		const alt = Math.max(playerAlt + (Math.random() - 0.5) * 1000, 1500);

		return this.createNPCMesh(name, lon, lat, alt, Math.random() * 360, 250 + Math.random() * 100);
	}

	createNPCMesh(name, lon, lat, alt, heading, speed) {
		if (!this.modelTemplate) return null;

		const group = new THREE.Group();
		const model = this.modelTemplate.clone();

		model.rotation.x = Math.PI / 2;
		model.scale.set(1.0, 1.0, 1.0);

		group.add(model);
		group.matrixAutoUpdate = false;
		this.scene.add(group);

		const mixer = new THREE.AnimationMixer(model);
		const clip = THREE.AnimationClip.findByName(this.animations, 'flight_mode');
		if (clip) {
			const action = mixer.clipAction(clip);
			action.setLoop(THREE.LoopOnce);
			action.clampWhenFinished = true;
			action.play();
		}

		const npc = {
			id: name + '_' + Math.random().toString(36).substr(2, 9),
			mesh: group,
			mixer: mixer,
			name: name,
			lon: lon, lat: lat, alt: alt,
			heading: heading,
			pitch: 0, roll: 0,
			speed: speed,
			throttle: 0.7,
			isBoosting: false,
			targetHeading: heading,
			targetPitch: 0,
			behaviorTimer: 5 + Math.random() * 10,
			terrainCheckTimer: Math.random() * 2,
			time: Math.random() * 100
		};

		this.npcs.push(npc);
		return npc;
	}

	update(dt, playerPos) {
		if (!this.loaded) return;

		const viewMatrix = this.viewer.camera.viewMatrix;

		for (let i = this.npcs.length - 1; i >= 0; i--) {
			const npc = this.npcs[i];
			if (npc.destroyed) {
				this.scene.remove(npc.mesh);
				this.npcs.splice(i, 1);
				continue;
			}
			npc.time += dt;

			npc.behaviorTimer -= dt;
			npc.terrainCheckTimer -= dt;

			if (npc.behaviorTimer <= 0) {
				npc.targetHeading = (npc.heading + (Math.random() - 0.5) * 120) % 360;
				npc.targetPitch = (Math.random() - 0.5) * 25;
				npc.behaviorTimer = 8 + Math.random() * 15;
				npc.isBoosting = Math.random() > 0.7;
				npc.throttle = 0.6 + Math.random() * 0.4;
			}

			if (npc.terrainCheckTimer <= 0) {
				npc.terrainCheckTimer = 0.5;
				const cartographic = Cesium.Cartographic.fromDegrees(npc.lon, npc.lat);
				const terrainHeight = this.viewer.scene.globe.getHeight(cartographic);
				if (terrainHeight !== undefined) {
					const relativeAlt = npc.alt - terrainHeight;
					if (relativeAlt < 500) {
						npc.targetPitch = Math.max(npc.targetPitch, 25);
						npc.isBoosting = true;
						npc.throttle = 1.0;
						if (relativeAlt < 100) npc.targetPitch = 45;
					}
				}
			}

			let headingDiff = npc.targetHeading - npc.heading;
			while (headingDiff < -180) headingDiff += 360;
			while (headingDiff > 180) headingDiff -= 360;

			const baseTurnRate = 30;
			const boostTurnRate = 90;
			const maxTurnRate = npc.isBoosting ? boostTurnRate : baseTurnRate;
			const maxTurnThisStep = maxTurnRate * dt;
			const headingChange = Math.max(-maxTurnThisStep, Math.min(maxTurnThisStep, headingDiff));
			npc.heading = (npc.heading + headingChange + 360) % 360;

			npc.pitch += (npc.targetPitch - npc.pitch) * dt * 0.6;

			let desiredRoll = 0;
			if (Math.abs(headingDiff) > 0.5) {
				const turnDir = Math.sign(headingDiff);
				const intensity = Math.min(1, Math.abs(headingDiff) / 45);
				desiredRoll = -turnDir * 90 * intensity;
			}
			const rollLerpSpeed = 3.0;
			npc.roll += (desiredRoll - npc.roll) * Math.min(1, dt * rollLerpSpeed);
			npc.roll = Math.max(-90, Math.min(90, npc.roll));

			const newPos = movePosition(npc.lon, npc.lat, npc.alt, npc.heading, npc.pitch, npc.speed * dt);
			npc.lon = newPos.lon;
			npc.lat = newPos.lat;
			npc.alt = newPos.alt;

			const pos = Cesium.Cartesian3.fromDegrees(npc.lon, npc.lat, npc.alt, undefined, this._scratchCartesian);

			this._scratchHPR.heading = Cesium.Math.toRadians(npc.heading);
			this._scratchHPR.pitch = Cesium.Math.toRadians(npc.roll);
			this._scratchHPR.roll = Cesium.Math.toRadians(npc.pitch);

			const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
				pos,
				this._scratchHPR,
				Cesium.Ellipsoid.WGS84,
				Cesium.Transforms.eastNorthUpToFixedFrame,
				this._scratchMatrix
			);

			const cameraSpaceMatrix = Cesium.Matrix4.multiply(viewMatrix, modelMatrix, this._scratchCameraMatrix);

			for (let i = 0; i < 16; i++) {
				this._scratchThreeMatrix.elements[i] = cameraSpaceMatrix[i];
			}

			npc.mesh.matrix.copy(this._scratchThreeMatrix);
			npc.mesh.updateMatrixWorld(true);

			if (npc.mixer) {
				npc.mixer.update(dt);
			}
		}

		if (this.npcs.length < 3 && Date.now() - this.lastSpawnTime > 5000) {
			this.spawnNPC(playerPos.lon, playerPos.lat, playerPos.alt);
			this.lastSpawnTime = Date.now();
		}
	}

	clear() {
		this.npcs.forEach(npc => {
			this.scene.remove(npc.mesh);
		});
		this.npcs = [];
	}
}
