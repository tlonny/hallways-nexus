import bpy
import sys

LIMITED_DISSOLVE_ANGLE_RADIANS = 0.08726646259971647


def output_path():
    # blender -b file.blend --python export_collider_glb.py -- /path/to/output.glb
    if "--" not in sys.argv:
        raise SystemExit("Missing output path")
    args = sys.argv[sys.argv.index("--") + 1 :]
    if not args or not args[0].strip():
        raise SystemExit("Missing output path")
    return bpy.path.abspath(args[0])


def cleanup_mesh(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.dissolve_degenerate()
    bpy.ops.mesh.dissolve_limited()
    bpy.ops.object.mode_set(mode="OBJECT")


out = output_path()
targets = [
    obj
    for obj in bpy.context.view_layer.objects
    if obj.type == "MESH"
    and (obj.name.startswith("collider.") or obj.name.startswith("level."))
]

if not targets:
    raise SystemExit("No mesh objects found with prefixes 'collider.' or 'level.'")

if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")

for obj in targets:
    cleanup_mesh(obj)

bpy.ops.object.select_all(action="DESELECT")
for obj in targets:
    obj.select_set(True)
bpy.context.view_layer.objects.active = targets[0]

bpy.ops.export_scene.gltf(
    filepath=out,
    export_format="GLB",
    use_selection=True,
    export_texcoords=False,
    export_normals=False,
    export_tangents=False,
    export_vertex_color="NONE",
    export_attributes=False,
    export_materials="NONE",
    export_image_format="NONE",
)

print(f"Exported {len(targets)} collider meshes to {out}")
