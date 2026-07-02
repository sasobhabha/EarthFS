import * as Cesium from 'cesium';

export function movePosition(lon, lat, alt, heading, pitch, distance) {
	const headingRad = Cesium.Math.toRadians(heading);
	const pitchRad = Cesium.Math.toRadians(pitch);

	const R = 6371000;

	const dLat = (distance * Math.cos(headingRad) * Math.cos(pitchRad)) / R;
	const dLon = (distance * Math.sin(headingRad) * Math.cos(pitchRad)) / (R * Math.cos(Cesium.Math.toRadians(lat)));
	const dAlt = distance * Math.sin(pitchRad);

	return {
		lon: lon + Cesium.Math.toDegrees(dLon),
		lat: lat + Cesium.Math.toDegrees(dLat),
		alt: alt + dAlt
	};
}
