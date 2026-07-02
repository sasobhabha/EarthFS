export async function reverseGeocode(lon, lat) {
	try {
		const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=5&addressdetails=1`);
		const data = await response.json();

		if (data && data.address) {
			const addr = data.address;
			const state = addr.state || addr.region || addr.province;
			const country = addr.country;

			if (state && country) {
				return `${state}, ${country}`.toUpperCase();
			} else if (country) {
				return country.toUpperCase();
			}
		}
	} catch (error) {
		console.error('Reverse geocoding error:', error);
	}
	return null;
}

export function calculateDistance(lon1, lat1, lon2, lat2) {
	const R = 6371e3;
	const φ1 = lat1 * Math.PI / 180;
	const φ2 = lat2 * Math.PI / 180;
	const Δφ = (lat2 - lat1) * Math.PI / 180;
	const Δλ = (lon2 - lon1) * Math.PI / 180;

	const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) *
		Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c;
}
