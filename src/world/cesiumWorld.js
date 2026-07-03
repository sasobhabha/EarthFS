import * as Cesium from 'cesium';

let viewer;
let miniViewer;
let pauseMiniViewer;

export function initCesium() {
	Cesium.Ellipsoid.default = Cesium.Ellipsoid.MARS;

	viewer = new Cesium.Viewer("cesiumContainer", {
		terrain: undefined,
		timeline: false,
		animation: false,
		baseLayerPicker: false,
		baseLayer: false,
		geocoder: false,
		shadows: false,
		homeButton: false,
		infoBox: false,
		sceneModePicker: false,
		selectionIndicator: false,
		navigationHelpButton: false,
		shouldAnimate: false,
		globe: new Cesium.Globe(Cesium.Ellipsoid.MARS),
		skyBox: Cesium.SkyBox.createEarthSkyBox(),
		skyAtmosphere: new Cesium.SkyAtmosphere(Cesium.Ellipsoid.MARS),
	});

	// Hide the globe so it doesn't conflict with Photorealistic 3D Tiles
	viewer.scene.globe.show = false;

	const scene = viewer.scene;
	scene.skyAtmosphere.atmosphereMieCoefficient = new Cesium.Cartesian3(
		9.0e-5,
		2.0e-5,
		1.0e-5,
	);
	scene.skyAtmosphere.atmosphereRayleighCoefficient = new Cesium.Cartesian3(
		9.0e-6,
		2.0e-6,
		1.0e-6,
	);
	scene.skyAtmosphere.atmosphereRayleighScaleHeight = 9000;
	scene.skyAtmosphere.atmosphereMieScaleHeight = 2700.0;
	scene.skyAtmosphere.saturationShift = -0.1;
	scene.skyAtmosphere.perFragmentAtmosphere = true;

	const bloom = viewer.scene.postProcessStages.bloom;
	bloom.enabled = true;
	bloom.uniforms.brightness = -0.5;
	bloom.uniforms.stepSize = 1.0;
	bloom.uniforms.sigma = 3.0;
	bloom.uniforms.delta = 1.5;
	scene.highDynamicRange = true;
	viewer.scene.postProcessStages.exposure = 1.5;

	Cesium.Cesium3DTileset.fromIonAssetId(3644333, {
		enableCollision: true,
	}).then(tileset => {
		viewer.scene.primitives.add(tileset);
	}).catch(error => {
		console.warn("Could not load Mars 3D Tiles:", error);
	});

	/* miniViewer = new Cesium.Viewer("minimapCesium", {
		terrain: null,
		timeline: false,
		animation: false,
		baseLayerPicker: false,
		geocoder: false,
		homeButton: false,
		infoBox: false,
		sceneModePicker: false,
		selectionIndicator: false,
		navigationHelpButton: false,
		fullscreenButton: false,
		shouldAnimate: false,
		skyBox: false,
		skyAtmosphere: false,
		contextOptions: {
			webgl: {
				preserveDrawingBuffer: true
			}
		}
	}); */

	/* pauseMiniViewer = new Cesium.Viewer("pauseMinimapCesium", {
		terrain: null,
		timeline: false,
		animation: false,
		baseLayerPicker: false,
		geocoder: false,
		homeButton: false,
		infoBox: false,
		sceneModePicker: false,
		selectionIndicator: false,
		navigationHelpButton: false,
		fullscreenButton: false,
		shouldAnimate: false,
		skyBox: false,
		skyAtmosphere: false,
		contextOptions: {
			webgl: {
				preserveDrawingBuffer: true
			}
		}
	}); */

	[viewer].forEach(v => {
		v.scene.requestRenderMode = false;
		v.scene.maximumRenderTimeChange = 0;
		if (v.scene.globe) v.scene.globe.maximumScreenSpaceError = 2;
		v.resolutionScale = 0.75;

		v.scene.screenSpaceCameraController.enableRotate = false;
		v.scene.screenSpaceCameraController.enableTranslate = false;
		v.scene.screenSpaceCameraController.enableZoom = false;
		v.scene.screenSpaceCameraController.enableTilt = false;
		v.scene.screenSpaceCameraController.enableLook = false;

		v.scene.screenSpaceCameraController.maximumZoomDistance = 25000000;

		if (v.scene.globe) {
			v.scene.globe.tileCacheSize = 2048;
			v.scene.globe.preloadAncestors = true;
			v.scene.globe.preloadSiblings = true;
			v.scene.globe.loadingDescendantLimit = 20;

			v.scene.globe.skipLevelOfDetail = true;
			v.scene.globe.baseScreenSpaceError = 1024;
			v.scene.globe.skipScreenSpaceErrorFactor = 16;
			v.scene.globe.skipLevels = 1;
		}

		v._cesiumWidget._creditContainer.style.display = "none";
	});

	

	if (viewer.scene.globe) {
		viewer.scene.globe.enableLighting = true;
	}
	viewer.scene.postProcessStages.fxaa.enabled = true;
	viewer.scene.skyAtmosphere.show = true;

	viewer.scene.fog.enabled = true;
	viewer.scene.fog.density = 0.0001;

	setControlsEnabled(false);

	return viewer;
}

export function setRenderOptimization(isMenu) {
	if (!viewer) return;

	[viewer].forEach(v => {
		v.scene.requestRenderMode = !isMenu;
		v.scene.maximumRenderTimeChange = !isMenu ? Infinity : 0;
	});
}

export function setControlsEnabled(enabled) {
	if (!viewer) return;
	const ctrl = viewer.scene.screenSpaceCameraController;
	ctrl.enableRotate = enabled;
	ctrl.enableTranslate = enabled;
	ctrl.enableZoom = enabled;
	ctrl.enableTilt = enabled;
	ctrl.enableLook = enabled;
}

export function setCameraToPlane(lon, lat, alt, heading, pitch, roll) {
	if (!viewer) return;

	viewer.camera.setView({
		destination: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
		orientation: {
			heading: Cesium.Math.toRadians(heading),
			pitch: Cesium.Math.toRadians(pitch),
			roll: Cesium.Math.toRadians(roll)
		}
	});

	viewer.scene.requestRender();
}

export function setMinimapCamera(lon, lat, altitude, heading) {
	if (!miniViewer) return;

	if (miniViewer.canvas.width === 0 || miniViewer.canvas.height === 0) {
		return;
	}

	miniViewer.camera.setView({
		destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
		orientation: {
			heading: Cesium.Math.toRadians(heading),
			pitch: Cesium.Math.toRadians(-90),
			roll: 0
		}
	});

	miniViewer.scene.requestRender();
}

export function setPauseMinimapCamera(lon, lat, altitude, heading) {
	if (!pauseMiniViewer) return;

	if (pauseMiniViewer.canvas.width === 0 || pauseMiniViewer.canvas.height === 0) {
		return;
	}

	pauseMiniViewer.camera.setView({
		destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
		orientation: {
			heading: Cesium.Math.toRadians(heading),
			pitch: Cesium.Math.toRadians(-90),
			roll: 0
		}
	});

	pauseMiniViewer.scene.requestRender();
}

export function getViewer() {
	return viewer;
}

export function getMiniViewer() {
	return miniViewer;
}

export function getPauseMiniViewer() {
	return pauseMiniViewer;
}
