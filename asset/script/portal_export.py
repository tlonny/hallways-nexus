import bpy
import sys


def args():
    # blender -b file.blend --python export_portal_glb.py -- "ExactObjectName" /path/to/output.glb
    if "--" not in sys.argv:
        raise SystemExit("Missing args: object_name output_path")
    vals = sys.argv[sys.argv.index("--") + 1 :]
    if len(vals) < 2 or not vals[0].strip() or not vals[1].strip():
        raise SystemExit("Missing args: object_name output_path")
    return vals[0], bpy.path.abspath(vals[1])


name, out = args()
obj = bpy.context.view_layer.objects.get(name)

if obj is None:
    raise SystemExit(f"Object not found (exact match required): {name}")
if obj.type != "MESH":
    raise SystemExit(f"Object is not a mesh: {name}")

if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_texcoords=False,
    export_normals=False,
    export_tangents=False,
    export_vertex_color="MATERIAL",
    export_attributes=False,
    export_materials="NONE",
    export_image_format="NONE",
)

print(f"Exported portal '{name}' to {out}")
