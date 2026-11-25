import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	ssr: {
		external: ["firebase-admin"],
	},
	plugins: [
		nitro({ rollupConfig: { external: [/^@sentry\//, "firebase-admin"] } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
	],
});

export default config;
