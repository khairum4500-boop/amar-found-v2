import 'dotenv/config';
import { z } from 'zod';
const env=z.object({BOT_TOKEN:z.string().min(1),ADMIN_IDS:z.string().min(1),PORT:z.coerce.number().default(3000),NODE_ENV:z.string().default('production'),TIMEZONE:z.string().default('Asia/Dhaka'),DB_PATH:z.string().default('./data/amar-found.sqlite')}).parse(process.env);
export const config={...env,adminIds:new Set(env.ADMIN_IDS.split(',').map(x=>Number(x.trim())).filter(Number.isFinite))};
