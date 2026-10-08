/**
 * The lab's settings, from stitch2.config.json: the nearest one above the working directory, or the file in
 * STITCH2_CONFIG. Paths in it are relative to the file. Without a config the lab uses ./design and defaults.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
const DEFAULTS = {
    name: 'stitch2',
    designDir: 'design',
    screenDirs: ['screens'],
    stitchDir: 'stitch',
    archiveDirs: [],
    catalogDir: 'screens/components',
    prefix: 's2',
    order: [],
    comfortableTarget: 32,
    skills: [],
};
export const CONFIG_NAME = 'stitch2.config.json';
function find() {
    if (process.env.STITCH2_CONFIG)
        return resolve(process.env.STITCH2_CONFIG);
    for (let dir = process.cwd();; dir = dirname(dir)) {
        if (existsSync(join(dir, CONFIG_NAME)))
            return join(dir, CONFIG_NAME);
        if (dirname(dir) === dir)
            return undefined;
    }
}
export const CONFIG_FILE = find();
/** The folder paths in the config are relative to (the project root). */
export const BASE = CONFIG_FILE ? dirname(CONFIG_FILE) : process.cwd();
export const config = {
    ...DEFAULTS,
    ...(CONFIG_FILE ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) : {}),
};
/** The design folder, with a trailing slash. */
export const ROOT = join(resolve(BASE, config.designDir), '/');
