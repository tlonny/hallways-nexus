import bpy
import json
import os
import sys


def output_path():
    # blender -b file.blend --python spawn_export.py -- /path/to/output.json
    if "--" not in sys.argv:
        raise SystemExit("Missing output path")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if not args or not args[0].strip():
        raise SystemExit("Missing output path")
    return bpy.path.abspath(args[0])


out = output_path()
spawn = bpy.context.view_layer.objects.get("spawn")
if spawn is None:
    raise SystemExit("Object not found (exact match required): spawn")

location = spawn.matrix_world.translation
# Match Blender glTF export axis conversion (Blender Z-up -> glTF Y-up).
payload = [location.x, location.z, -location.y]

os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w", encoding="utf-8") as handle:
    json.dump(payload, handle)
    handle.write("\n")

print(f"Exported spawn position to {out}: {payload}")
