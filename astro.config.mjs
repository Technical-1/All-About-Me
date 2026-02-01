// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(),
    tailwind(),
    mdx()
  ],
  // Static by default, API routes opt-in to server with prerender = false
  output: 'static',
  adapter: node({
    mode: 'standalone'
  })
});
