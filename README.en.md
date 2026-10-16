# ReaCut

An offline desktop video editor with a media library, multitrack timeline, editable captions, effects and local video export.

This is [Elson's English Windows fork](https://github.com/justelson/rea-capcut) of [ReaCut by Xiangyu-CAS](https://github.com/Xiangyu-CAS/rea-capcut). The original project used [REA](https://github.com/morluto/rea) to research CapCut's behavior and project formats, then independently implemented its editor. No CapCut proprietary code or assets are included. You do not need REA, Ghidra or CapCut to run ReaCut.

## Windows edition

Version **0.6.0** makes product text English throughout the editor, native menus, dialogs, validation messages, presets and optional assistant. Existing project names, filenames, captions and other user content keep their original language.

The custom title bar uses native Windows caption buttons, including maximize and Snap support. macOS keeps its traffic lights on the left; Linux uses Electron's native window-controls overlay. Windows is the release target for this fork. Cross-platform source support does not mean Mac and Linux packages have been tested.

Download the installer or standalone ZIP from [Releases](https://github.com/justelson/rea-capcut/releases). Release packages include source/build metadata and SHA-256 checksums. Windows preview builds are unsigned.

1. Run the Setup EXE, or extract the standalone ZIP and open `ReaCut.exe`.
2. Install FFmpeg and FFprobe separately. Windows packages currently do not bundle them.
3. Open **Settings** and check both media tools. You can select their executable paths there.
4. Import your media, edit the timeline, save a `.reacut` project, and export an MP4 or MOV.

FFmpeg needs H.264 `libx264` and AAC encoding support. A silent per-user installation can use `"ReaCut.Setup.0.6.0.exe" /S --current-user`; silent setup does not launch the editor.

Read the [English user guide](docs/USER_GUIDE.md) for editing, captions, project collection, shortcuts and export.

## Editing tools

- Video, audio and image import; source preview with in/out points; thumbnails and waveforms.
- Multitrack drag, trim, split, duplicate, multiselect, snapping, lock, mute, hide, undo and redo.
- Position, scale, rotation, opacity, cropping, chroma key, rectangle/ellipse masks and keyframes.
- Volume, fades, constant speed changes, color adjustments, text templates, effects and transitions.
- SRT/basic WebVTT captions, batch replacements, caption export and local project recovery.
- Missing-media relinking, portable media collection, full-timeline and range export.

This remains an early editor. It does not implement every CapCut feature, professional HDR/color management, cloud projects, automatic speech captions or AI portrait cutout. Experimental CapCut/Jianying draft import is lossy and does not promise compatibility with arbitrary versions or projects.

## Build from source

Use Node.js 26, or Node.js 24.11+ within the 24.x release line, plus npm, FFmpeg and FFprobe.

```sh
npm ci
node node_modules/electron/install.js
npm run dev
```

```sh
npm run check
npm run demo
npm run test:desktop
npx electron-builder --win nsis zip --x64 --publish never
```

The **Windows preview** Actions workflow builds the installer and ZIP, runs core tests, and checks the actual packaged app with generated media. Its evidence separates packaging, editing, rendered UI and export results. See [the workflow](.github/workflows/windows-preview.yml).

## Data and optional assistant

Ordinary editing and media export run locally. Projects reference source files unless you collect them into a portable folder. The optional editing assistant uses an installed, authenticated Codex or Claude CLI only when you send a request; prompts, bounded conversation history and a project summary then go to that service. Raw media is not attached by this path.

The optional Codex side-panel plugin is separate from ordinary desktop editing. Its Windows host behavior is not part of the desktop release guarantee.

## Source and licenses

Editor UI lives in `src/components`, editing state in `src/editor`, project/timeline logic in `src/core`, and file/media integration in `electron`. The English fork's title-bar code is in `src/window` and `electron/windowChrome.ts`.

Original source uses the [MIT license](LICENSE). Dependencies retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md). The original [Chinese README](README.zh-CN.md), [Chinese user guide](docs/USER_GUIDE.zh-CN.md), and historical research documents remain available for provenance. They describe upstream work and should not be treated as current Windows acceptance evidence.
