import bpy
import sys


def output_path():
    # blender -b file.blend --python export_model_glb.py -- /path/to/output.glb
    if "--" not in sys.argv:
        raise SystemExit("Missing output path")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if not args or not args[0].strip():
        raise SystemExit("Missing output path")
    return bpy.path.abspath(args[0])


out = output_path()
targets = [
    obj
    for obj in bpy.context.view_layer.objects
    if obj.type == "MESH"
    and (obj.name.startswith("level.") or obj.name.startswith("model."))
]

if not targets:
    raise SystemExit("No mesh objects found with prefixes 'level.' or 'model.'")

if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
for obj in targets:
    obj.select_set(True)
bpy.context.view_layer.objects.active = targets[0]

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_texcoords=True,
    export_normals=False,
    export_tangents=False,
    export_vertex_color="NONE",
    export_attributes=False,
    export_materials="EXPORT",
    export_image_format="NONE",
)

print(f"Exported {len(targets)} objects to {out}")
