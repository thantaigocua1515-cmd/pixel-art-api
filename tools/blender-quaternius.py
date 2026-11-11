"""Blender headless: convert Quaternius Ultimate Animated Character Pack FBX -> GLB.
Run: blender -b --python tools/blender-quaternius.py"""
import bpy
import os
import sys
import zipfile

ROOT = "/home/hatch/workspace/pixel-art-api"
ZIP = os.path.join(ROOT, "data-raw/quaternius/animated-character-oga.zip")
STAGE = os.path.join(ROOT, "data-raw/extract/quaternius-chars")
OUTDIR = os.path.join(ROOT, "public/models/quaternius/animated-character-pack")
os.makedirs(OUTDIR, exist_ok=True)
if not os.path.exists(STAGE):
    zipfile.ZipFile(ZIP).extractall(STAGE)

fxs_list = []
for dirpath, _, files in os.walk(STAGE):
    for f in files:
        if f.lower().endswith(".fbx"):
            fxs = os.path.join(dirpath, f)
            fxs_name = os.path.splitext(f)[0]
            fxs_parent = os.path.basename(dirpath)
            fxs_out = fxs_parent if fxs_parent not in ("FBX", "fbx", "") else fxs_name
            fxs_list.append((fxs, fxs_out))
print("FBX files:", len(fxs_list))

done = 0
for src, outname in fxs_list:
    out = os.path.join(OUTDIR, outname + ".glb")
    if os.path.exists(out):
        done += 1
        continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.fbx(filepath=src)
    except Exception as e:
        print("IMPORT FAIL", src, e)
        continue
    try:
        bpy.ops.export_scene.gltf(filepath=out, export_format="GLB",
                                  export_animations=True, export_yup=True)
        done += 1
        print("OK", outname)
    except Exception as e:
        print("EXPORT FAIL", src, e)
print("QUATERNIUS BLENDER DONE", done)
