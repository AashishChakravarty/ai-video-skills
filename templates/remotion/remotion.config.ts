/** remotion.config.ts: CLI defaults for studio and `remotion render` (render-clips.mjs passes the alpha flags itself). */
import { Config } from '@remotion/cli/config';

Config.setRspack(true);
Config.setOverwriteOutput(true);
