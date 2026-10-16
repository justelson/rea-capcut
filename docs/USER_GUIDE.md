# ReaCut user guide

## Start a project

Open **Settings** and check FFmpeg and FFprobe. Windows previews require these tools separately; choose their executables if automatic discovery cannot find them. FFmpeg needs `libx264` and AAC support for export.

A new project starts at 1920 × 1080 and 30 fps. With no clip selected, the right-hand inspector shows the name, canvas ratio, dimensions, frame rate and background.

Use **Import media** or drag local video, audio and images into the editor. Single-click to preview a source. Double-click or use its add button to place it on the timeline; drag to an unlocked compatible track to choose its position.

Save through **File → Save project**. A normal `.reacut` file references media in its original locations. Moving the media can break those references; relink missing sources or collect a portable project before moving everything.

## Window and workspace

Drag an empty part of the custom top bar to move the window. Windows uses native minimize, maximize/restore and close buttons on the right, with operating-system Snap behavior. Double-clicking the draggable area uses the system's maximize/restore behavior. Menus, project-name input and action buttons remain clickable.

macOS keeps traffic-light controls on the left. Linux uses Electron's native controls. The bar reserves space for the platform's controls so they do not cover project actions.

Drag the dividers between the media library, player and inspector to resize panels. Focus a divider and use arrow keys for small adjustments; Shift moves faster. Double-click or press Home to reset. Drag the divider above the timeline, or use its up/down arrow keys, to change timeline height.

## Preview and insert a source range

Select a media card to open its source preview. Video and audio support playback, frame stepping and in/out points. While that preview has focus, **I** marks the in point, **O** the out point, and Space plays the selection. Insert the range at the timeline playhead. Double-clicking or using the regular add button inserts the full source.

Return to the timeline to switch back to the project player. Locked tracks cannot receive edits. Missing or undecodable sources must be relinked or converted first.

## Edit the timeline

Click a clip to select it. Use the platform's selection modifier to select several. Drag to move a clip in time or onto a compatible track; drag its edges to trim. Put the playhead inside a clip and use Split or **Ctrl+B** on Windows/Linux, **Cmd+B** on Mac.

Tracks can be renamed, reordered, deleted, locked, muted or hidden. Deleting a nonempty track asks for confirmation, preserves the source in the media library and can be undone. Locked tracks cannot be edited or reordered. Hiding a video layer does not mute its audio; use Mute for that.

Snapping aligns nearby clip edges and markers. Ripple deletion closes the deleted interval on the same track. Overlapping clips appear on separate subrows so each remains selectable. Undo and redo cover normal timeline changes.

## Picture, audio and animation

Select a visual clip to adjust position, scale, rotation, flipping and opacity. Drag its image in the player to preview a position change, then release to commit one undoable edit. If the property has keyframes, dragging moves the animation path together.

Use the inspector for color, cropping, chroma key, masks and animation. Chroma key removes a chosen RGB color; it is not AI portrait cutout. Masks support rectangles and ellipses with feathering and inversion.

Audio controls include volume, mute and fades. Picture and audio fades are separate. Detaching audio creates an independent audio source and mutes the video's sound. Constant speed ranges from 0.1× to 8×; duration changes while audio processing preserves pitch.

Move the playhead and click a property's diamond to add a keyframe. The animation panel lets you inspect/remove keyframes and choose linear or smooth interpolation. Trimming, splitting and speed changes preserve relevant animation intervals and fade envelopes.

## Text, presets and captions

Add an editable template from the text library, then edit its content, font, size, color, alignment, stroke and background in the inspector. Built-in recipes belong to this project and do not include CapCut proprietary templates.

Effects include color and motion presets. Motion presets replace keyframes for the affected properties, preserving other settings. For a transition, select the first of two adjacent visual clips on the same track, choose a transition and duration. Transitions cannot bridge gaps, alter locked tracks or conflict with later clips.

Import SRT or basic WebVTT through the captions tools. Captions become editable text clips. The captions panel supports search, multiselect, text/timing edits, batch time shifts, find/replace and shared styling. Review a batch change before applying it. Edits are frame-aligned and undoable.

Caption export writes SRT from the project's text clips. Full WebVTT styling and positioning are not preserved. Automatic speech recognition is not included. Your own captions, filenames and project text retain the language you wrote them in.

## Move a project with its media

Use **File → Collect project media** and choose a destination. ReaCut copies original media, deduplicates shared sources, removes cache references and writes a portable `.reacut` project. Move the complete folder, including `media`. Collection does not modify originals.

You can keep editing a reopened portable project and collect newly added sources when saving. Fonts still depend on the destination computer and ReaCut's bundled font. Missing sources must be relinked before collection.

## Export video

Choose **Export** in the top bar. Select the full timeline, selected clips' range, or a custom interval; choose dimensions, frame rate, quality and MP4 or MOV. Pick the output file and start export.

Output uses H.264 video and AAC audio. Export writes a temporary file and replaces the chosen destination only after success. Cancel stops the job and removes unfinished output. Keep the project and media until you have checked the rendered video.

## Keyboard shortcuts

| Action | Windows / Linux | macOS |
| --- | --- | --- |
| Play / pause | Space | Space |
| Split | Ctrl+B | Cmd+B |
| Delete | Delete / Backspace | Delete / Backspace |
| Undo | Ctrl+Z | Cmd+Z |
| Redo | Ctrl+Shift+Z / Ctrl+Y | Cmd+Shift+Z |
| Copy / paste | Ctrl+C / Ctrl+V | Cmd+C / Cmd+V |
| Duplicate | Ctrl+D | Cmd+D |
| Select all | Ctrl+A | Cmd+A |
| New / open / save | Ctrl+N / Ctrl+O / Ctrl+S | Cmd+N / Cmd+O / Cmd+S |
| Import / export | Ctrl+I / Ctrl+E | Cmd+I / Cmd+E |
| Previous / next frame | Left / Right | Left / Right |
| Timeline zoom | + / − | + / − |
| Beginning / end | Home / End | Home / End |

Input fields keep normal text-editing shortcuts. Some shortcuts are scoped to the focused preview or timeline. Use **Keyboard shortcuts** for the editor's reference.

## Optional features and limits

The editing assistant is optional. Sending a message invokes your installed, signed-in Codex or Claude CLI with your prompt, bounded history and a project summary. Review proposed edits before applying them. Ordinary editing does not require an AI account.

CapCut/Jianying import is experimental and lossy. Choose a draft file or project folder and, when prompted, its timeline. Check canvas, timing, missing media and text before saving as `.reacut`. Complex effects, fonts and keyframes may be lost. ReaCut does not write CapCut drafts back or promise arbitrary-version compatibility.

This is an early editor. Large projects, unusual codecs and advanced color/HDR workflows need separate validation. Keep backups of important work.
