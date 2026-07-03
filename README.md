# EarthFS

A browser-based full-featured flight simulator built with WebGL (Three.js) and Google Maps Photorealistic 3D Tiles.

## Features
- **Global Photorealistic Terrain:** Streams 3D tiles directly from Google Maps API to allow flying anywhere on Earth.
- **Realistic Flight Physics:** Implements fixed-wing aircraft dynamics for a Cessna 172, including lift, drag, thrust, and stall behavior.
- **Dynamic ECEF Gravity:** Accurately models planetary scale. Gravity always pulls towards the Earth's center, not just "down" on the Y-axis.
- **Multiple Camera Views:** Supports Cockpit view, Chase view, and Free-fly cinematic view.
- **Inputs:** Supports Keyboard and Gamepad inputs.
- **HUD:** Displays Altitude, Speed (Knots), Heading, Throttle, and a minimap.

## Setup Instructions

1. **Clone and Install dependencies:**
   ```bash
   npm install
   ```

2. **Obtain a Google Maps 3D Tiles API Key:**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project or select an existing one.
   - Enable the **Map Tiles API**.
   - Go to Credentials and create an **API Key**.
   - Make sure you have billing enabled (Photorealistic 3D Tiles require a billing account, though there is a free tier).

3. **Run the Development Server:**
   ```bash
   npm run dev
   ```

4. **Play the Game:**
   - Open the provided localhost URL in your browser (e.g., `http://localhost:5173`).
   - Paste your Google Maps API Key into the menu prompt and click "Start Flight".

## Controls

### Keyboard
- **Pitch:** \`W\` / \`S\` or \`Up\` / \`Down\` arrows
- **Roll:** \`A\` / \`D\` or \`Left\` / \`Right\` arrows
- **Yaw (Rudder):** \`Q\` / \`E\`
- **Throttle:** \`Shift\` (Increase) / \`Ctrl\` (Decrease)
- **Change Camera:** \`V\`

### Gamepad (Xbox/PlayStation)
- **Pitch/Roll:** Left Stick
- **Yaw (Rudder):** Triggers (L2 / R2)
- **Throttle:** D-Pad Up / Down
- **Change Camera:** Top Face Button (Y / Triangle)

## Architecture

- \`src/physics/\`: Handles fixed-wing aerodynamics and spherical gravity based on Earth Centered, Earth Fixed (ECEF) coordinates.
- \`src/graphics/\`: Initializes Three.js WebGL renderer, scene, camera, and lighting.
- \`src/network/\`: Streams Google Earth 3D Tiles using the \`3d-tiles-renderer\` library.
- \`src/ui/\`: Manages the HTML HUD overlay (Speed, Altitude, Heading, Minimap).
- \`src/main.ts\`: The core game loop that orchestrates rendering, physics updates, and user input.

Enjoy flying around the world!
