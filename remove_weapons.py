import sys
import re

p = 'src/main.js'
with open(p, 'r') as f:
    content = f.read()

# Remove import
content = re.sub(r"import \{ WeaponSystem \} from './systems/weaponSystem';\n?", "", content)

# Remove let weaponSystem;
content = re.sub(r"let weaponSystem;\n?", "", content)

# Remove weaponSystem: null
content = re.sub(r"\s*weaponSystem:\s*null,?", "", content)

# Remove weaponSystem initialization block
content = re.sub(r"\s*weaponSystem = new WeaponSystem[\s\S]*?};\n", "\n", content)

# Remove state.weaponSystem = weaponSystem;
content = re.sub(r"\s*state\.weaponSystem = weaponSystem;\n", "\n", content)

# Remove weaponSystem if block
content = re.sub(r"\s*if \(weaponSystem\) \{[\s\S]*?weaponSystem\.update\(dt, state, input\);\n\t\t\}\n", "\n", content)

# Remove weaponsHud lines
content = re.sub(r"\s*const weaponsHud = document\.getElementById\('weapons-hud'\);\n\s*if \(weaponsHud\) weaponsHud\.classList\.(add|remove)\('hidden'\);\n?", "", content)

# Remove any leftover resetAmmo calls
content = re.sub(r"\s*if \(weaponSystem && typeof weaponSystem\.resetAmmo === 'function'\) \{\n\s*weaponSystem\.resetAmmo\(\);\n\s*\}\n?", "", content)

# Save
with open(p, 'w') as f:
    f.write(content)
