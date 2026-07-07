---
title: "I Built the Same App Five Times to Learn Five Stacks"
description: "I picked one problem I understood cold, image to ASCII art, and rebuilt it across Flask, Vite, a video version, React Native, and a CLI. When the algorithm is boring and known, the stack is the teacher."
pubDate: 2026-08-07T11:00:00-04:00
tags: ["Web Development", "React Native", "Learning by Building", "Performance"]
---

Most learning projects pick a stack first and then go hunting for a problem to throw at it. I did the opposite. I picked one problem I understood cold, image to ASCII art, and rebuilt it five separate times across five different stacks. Same idea every time: take pixels, map brightness to characters, show the result. The problem never changed, so the only variable left was the stack. That's the whole point. When the algorithm is boring and known, every new thing you struggle with is the thing the stack is actually teaching you.

Here's what each rebuild taught me that the others couldn't.

## Flask: the version with a server in the middle

The first one, Image-To-Ascii-Flask, was a Python web app. The browser collects an image plus width, height, and a character set, then POSTs the file to a `/convert` endpoint as multipart form data. Flask validates the upload, Pillow does the grayscale conversion and a high-quality LANCZOS resize down to the character grid, and the server hands back JSON the page renders.

Putting the conversion behind a server taught me the things a server forces you to care about. Uploads are an attack surface, so the endpoint runs an extension allowlist, clamps dimensions to a sane range, caps the request body at 16 MB, and returns a generic 500 while logging the real exception so error text can't leak internals or reflect XSS back at the user. Images get read straight from the stream in memory, no upload directory, so there's no temp-file cleanup or writable-disk requirement. SVG support meant a second dependency (cairosvg) that I lazy-import only inside the SVG branch, so every non-SVG request boots without touching it. And it ships on gunicorn with two workers, not the Flask dev server, because `app.run()` is single-threaded and not meant for production. None of that is conversion logic. All of it is what it costs to run conversion on a box that strangers can reach.

## Vite + vanilla JS: delete the server entirely

Image-To-Ascii-Vite is the same converter with the server taken out. Everything moved client-side: the Canvas API draws the image at the target dimensions and reads back the pixels, and the whole pipeline (Sobel edge detection, brightness and contrast, weighted luminance, character mapping, color modes) runs in the tab. The shipped app has zero runtime dependencies, about 38 kB of hand-written code.

Killing the server changed which problems even exist. There's no upload validation because nothing gets uploaded; the privacy story becomes "your image never leaves your device." But moving compute into the browser created a fresh class of bugs the Flask version never had. Conversion is async and debounced off slider input, so a slow earlier decode can resolve after a faster later one and overwrite fresh output with stale art. The fix is a monotonic token per run that bails after the await if a newer run started. Color modes render a `<span>` per character, so a big enough grid would allocate millions of DOM nodes and OOM mobile Safari, which is why there's a hard cell budget that falls back to plain text past the limit. Sharing went fully client-side too: the downscaled image and settings get base64-encoded into a `#s=` URL fragment, so opening a link regenerates the art with no network call and nothing to expire. (An earlier prototype stashed share payloads in Redis behind a serverless route. Encoding into the fragment deleted that entire piece of infrastructure.) Flask taught me to defend a server. Vite taught me that the browser is its own runtime with its own ways to fall over.

## Video-To-Ascii: the same thing, sixty times a second

Then I made it move. Video-To-Ascii is browser-based and fully client-side again, but now a `requestAnimationFrame` loop pulls frames off a `<video>` element, runs each one through the same pixel-to-character pipeline, and writes it to the DOM. Six character sets, four color modes, GIF export.

A still image converts once and you're done. A video converts forever, so suddenly the frame budget is the whole game. Targeting a flat 60 fps on modest hardware just makes the loop fall behind and the browser jank-warn, so the controller measures real frame time and throttles the target FPS down when it lags, then ratchets back up when slack appears. Recording frames is unbounded by default and each frame holds a per-cell color array, so a long clip will OOM the tab; there's a hard 1,800-frame cap that auto-stops. GIF export of every recorded frame at full size would take minutes, so it samples down to 120 frames and reports drawing and encoding progress through a callback while gif.js does the encoding off the main thread in a worker. This is the version that taught me performance as a moving target instead of a one-shot.

## React Native + Expo: one codebase, three platforms

Ascii-React-Native is the converter as an actual app: React Native and Expo, running on web, iOS, and Android from one codebase, with live resolution and character controls.

The interesting constraint here is that React Native has no DOM, so the browser's `<canvas>` trick for reading pixels simply doesn't exist on a phone. But the brightness-to-glyph mapping, the color modes, the edge detection: those are identical everywhere. So I split the app along exactly that line. Everything platform-agnostic lives in a pure `asciiCore.js` with zero React, DOM, or native imports, which makes it unit-testable in isolation. The one genuinely per-platform piece, getting raw RGBA bytes out of an image, sits behind a two-file interface with the same async signature: web uses an offscreen `<canvas>`, native uses a Skia offscreen surface. Metro picks the right file by extension, so the native-only Skia dependency never leaks into the web bundle. This rebuild taught me to find the real seam in cross-platform work. Almost all of it is shared; you isolate the tiny part that genuinely differs and you don't let it contaminate the rest.

## img2ascii: take everything away

The last one goes the other direction entirely. img2ascii is a command-line tool: one Python file, Pillow as the only dependency, grayscale only. No color, no edge detection, no live preview, no server.

After four increasingly capable versions, the lesson of the CLI was knowing what to leave out. A command-line tool's whole value is portability and scriptability, so heavy dependencies work against it; `pip install` should be fast and the thing should vendor cleanly into other projects. So color and interactivity stay in the web apps where they belong, and the CLI does one job. The core function takes a path, a PIL image, or a file-like object, which means the same code works from the terminal, from another script, and from a server handling uploads. Restraint turned out to be a design skill, not a shortcut.

## What the repetition was actually for

Five builds, one problem. Server-side validation and deployment with Flask. The browser as a runtime, with its async and memory traps, in Vite. Performance as a per-frame budget in the video version. The shared-core-with-a-thin-platform-seam pattern in React Native. And restraint in the CLI. None of those lessons land if you only build the thing once. Picking a problem I could already solve in my sleep was the point: it cleared the deck so the stack could be the teacher. I'd do it again with the next five.
