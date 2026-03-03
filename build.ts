import { copyFile, mkdir, readdir, rm } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { number, parse, tuple } from "valibot";

type ManifestColor = readonly [number, number, number, number];
type ManifestSpawn = readonly [number, number, number];

const ROOT_DIR = import.meta.dir;
const ASSET_DIR = resolve(ROOT_DIR, "asset");
const SCRIPT_DIR = resolve(ASSET_DIR, "script");
const DIST_DIR = resolve(ROOT_DIR, "dist");

const MODEL_EXPORT_SCRIPT_PATH = resolve(SCRIPT_DIR, "model_export.py");
const COLLIDER_EXPORT_SCRIPT_PATH = resolve(SCRIPT_DIR, "collider_export.py");
const PORTAL_EXPORT_SCRIPT_PATH = resolve(SCRIPT_DIR, "portal_export.py");
const SPAWN_EXPORT_SCRIPT_PATH = resolve(SCRIPT_DIR, "spawn_export.py");

const FLOOR_TEXTURE_SRC_PATH = resolve(ASSET_DIR, "floor.png");
const WATER_FRAMES_SRC_DIR = resolve(ASSET_DIR, "water_frames");

const MODEL_GLB_PATH = resolve(DIST_DIR, "model.glb");
const COLLIDER_GLB_PATH = resolve(DIST_DIR, "collider.glb");
const HOLE_GLB_PATH = resolve(DIST_DIR, "hole.glb");
const SPAWN_JSON_PATH = resolve(DIST_DIR, "spawn.json");
const MANIFEST_JSON_PATH = resolve(DIST_DIR, "manifest.json");
const ASSET_DIST_DIR = resolve(DIST_DIR, "asset");
const FLOOR_TEXTURE_DIST_PATH = resolve(DIST_DIR, "asset", "floor.png");
const WATER_FRAMES_DIST_DIR = resolve(DIST_DIR, "asset", "water_frames");

const MATERIAL_COLOR_RED: ManifestColor = [255, 0, 0, 255];
const MATERIAL_COLOR_GREEN: ManifestColor = [0, 255, 0, 255];
const MATERIAL_COLOR_WHITE_50_ALPHA: ManifestColor = [255, 255, 255, 128];
const MANIFEST_VERSION = "coco" as const;
const MANIFEST_SPAWN_SCHEMA = tuple([number(), number(), number()]);

const BLENDER_PATH = process.env.BLENDER_PATH as string;
const HOLE_OBJECT_NAME = "portal.hole" as const;
const WATER_ANIMATION_SPEED = 0.05 as const;

const asPosixRelative = (path: string): string => relative(DIST_DIR, path).replaceAll("\\", "/");

const resolveBlendPath = async (): Promise<string> => {
    const explicit = process.env.BLEND_PATH?.trim();
    const candidates = [
        explicit,
        resolve(ROOT_DIR, "scene.blend"),
        resolve(ASSET_DIR, "scene.blend"),
    ].filter((item): item is string => Boolean(item));

    for (const candidate of candidates) {
        if (await Bun.file(candidate).exists()) {
            return candidate;
        }
    }

    throw new Error(
        [
            "Could not find a blend file.",
            "Set BLEND_PATH or place scene.blend in project root or asset/scene.blend.",
        ].join(" "),
    );
};

const runCommand = async (command: readonly string[]): Promise<void> => {
    const proc = Bun.spawn([...command], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
    });

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
        throw new Error(`Command failed with exit code ${exitCode}: ${command.join(" ")}`);
    }
};

const blenderExport = async (
    blendPath: string,
    scriptPath: string,
    scriptArgs: readonly string[],
): Promise<void> => {
    await runCommand([
        BLENDER_PATH,
        "-b",
        blendPath,
        "--python",
        scriptPath,
        "--",
        ...scriptArgs,
    ]);
};

const copyTextures = async (): Promise<{ readonly waterFrames: readonly string[]; readonly trackPath: string }> => {
    await mkdir(ASSET_DIST_DIR, { recursive: true });
    await copyFile(FLOOR_TEXTURE_SRC_PATH, FLOOR_TEXTURE_DIST_PATH);

    await rm(WATER_FRAMES_DIST_DIR, { recursive: true, force: true });
    await mkdir(WATER_FRAMES_DIST_DIR, { recursive: true });

    const waterFrameEntries = (await readdir(WATER_FRAMES_SRC_DIR))
        .filter((name) => name.toLowerCase().endsWith(".png"))
        .sort((a, b) => a.localeCompare(b));

    const copiedWaterFramePaths: string[] = [];
    for (const entry of waterFrameEntries) {
        const srcPath = resolve(WATER_FRAMES_SRC_DIR, entry);
        const dstPath = resolve(WATER_FRAMES_DIST_DIR, entry);
        await copyFile(srcPath, dstPath);
        copiedWaterFramePaths.push(dstPath);
    }

    const oggEntries = (await readdir(ASSET_DIR))
        .filter((name) => name.toLowerCase().endsWith(".ogg"))
        .sort((a, b) => a.localeCompare(b));

    if (oggEntries.length === 0) {
        throw new Error(`No .ogg files found in ${ASSET_DIR}`);
    }

    const copiedOggPaths: string[] = [];
    for (const entry of oggEntries) {
        const srcPath = resolve(ASSET_DIR, entry);
        const dstPath = resolve(ASSET_DIST_DIR, entry);
        await copyFile(srcPath, dstPath);
        copiedOggPaths.push(dstPath);
    }

    const trackPath = copiedOggPaths[0];
    if (trackPath === undefined) {
        throw new Error(`No .ogg files copied from ${ASSET_DIR}`);
    }

    return {
        waterFrames: copiedWaterFramePaths,
        trackPath,
    };
};

const loadSpawn = async (): Promise<ManifestSpawn> => {
    const data = (await Bun.file(SPAWN_JSON_PATH).json()) as unknown;
    return parse(MANIFEST_SPAWN_SCHEMA, data) as ManifestSpawn;
};

const writeManifest = async (spawn: ManifestSpawn, waterFrames: readonly string[], trackPath: string): Promise<void> => {
    const manifest = {
        _version: MANIFEST_VERSION,
        meta: {
            name: "hallways-nexus",
            author: "tlonny <timlonsdale@gmail.com>"
        },
        level: {
            track: asPosixRelative(trackPath),
            model: basename(MODEL_GLB_PATH),
            collider: basename(COLLIDER_GLB_PATH),
            spawn,
            materials: {
                floor: {
                    frames: [asPosixRelative(FLOOR_TEXTURE_DIST_PATH)] 
                },
                water: {
                    frames: waterFrames.map(asPosixRelative),
                    animation_speed: WATER_ANIMATION_SPEED,
                    color: MATERIAL_COLOR_WHITE_50_ALPHA,
                },
                rim: {
                    color: MATERIAL_COLOR_GREEN,
                },
                red: {
                    color: MATERIAL_COLOR_RED,
                },
            },
        },
        portals: {
            hole: {
                collider: basename(HOLE_GLB_PATH),
                target: {
                    "name": "hole",
                    "href": "https://tlonny.github.io/hallways-nostalgia/hangar.json"
                }
            },
        },
    };

    await Bun.write(MANIFEST_JSON_PATH, `${JSON.stringify(manifest, null, 4)}\n`);
};

const main = async (): Promise<void> => {
    await mkdir(DIST_DIR, { recursive: true });

    const blendPath = await resolveBlendPath();
    console.log(`[build] blend: ${blendPath}`);

    const { waterFrames, trackPath } = await copyTextures();
    console.log(`[build] copied assets: floor + ${waterFrames.length} water frames + track ${basename(trackPath)}`);

    await blenderExport(blendPath, MODEL_EXPORT_SCRIPT_PATH, [MODEL_GLB_PATH]);
    await blenderExport(blendPath, COLLIDER_EXPORT_SCRIPT_PATH, [COLLIDER_GLB_PATH]);
    await blenderExport(blendPath, PORTAL_EXPORT_SCRIPT_PATH, [HOLE_OBJECT_NAME, HOLE_GLB_PATH]);
    await blenderExport(blendPath, SPAWN_EXPORT_SCRIPT_PATH, [SPAWN_JSON_PATH]);
    console.log("[build] exported model.glb, collider.glb, hole.glb, spawn.json");

    const spawn = await loadSpawn();
    await writeManifest(spawn, waterFrames, trackPath);
    console.log(`[build] wrote manifest: ${MANIFEST_JSON_PATH}`);
};

await main();
