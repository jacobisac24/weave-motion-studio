// Browser-based video export — renders timeline blocks to canvas frame-by-frame,
// records via MediaRecorder, and downloads a WebM file. No server needed.

import { useCallback, useRef, useState } from "react";
import type { Block, Project } from "@/types/block";
import { getBlockRenderer } from "@/blocks/registry";
import { createRoot } from "react-dom/client";
import React from "react";

/** Get active block at a given time */
function getActiveBlock(blocks: Block[], time: number): Block | null {
  return blocks.find((b) => time >= b.startTime && time < b.startTime + b.duration) ?? null;
}

export type ExportStatus = "idle" | "rendering" | "encoding" | "done" | "error";

export function useVideoExport() {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const cancelRef = useRef(false);

  const exportVideo = useCallback(async (project: Project) => {
    cancelRef.current = false;
    setStatus("rendering");
    setProgress(0);

    const width = project.width;
    const height = project.height;
    const fps = project.fps;

    // Compute total duration from blocks
    const totalDuration = project.durationOverride ??
      Math.max(project.blocks.reduce((max, b) => Math.max(max, b.startTime + b.duration), 0), 0.1);
    const totalFrames = Math.ceil(totalDuration * fps);

    // Create offscreen canvas for recording
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;

    // Hidden container for rendering React SVG components
    const container = document.createElement("div");
    container.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${width}px;height:${height}px;`;
    document.body.appendChild(container);

    // Set up MediaRecorder on canvas stream
    const stream = canvas.captureStream(0); // 0 = manual frame capture
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    const recordingDone = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };
    });

    recorder.start();

    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        if (cancelRef.current) break;

        const time = frame / fps;
        const activeBlock = getActiveBlock(project.blocks, time);

        // Clear canvas with dark background
        ctx.fillStyle = "#0f1117";
        ctx.fillRect(0, 0, width, height);

        if (activeBlock) {
          const Renderer = getBlockRenderer(activeBlock.type);
          if (Renderer) {
            const blockProgress = Math.min(1, Math.max(0,
              (time - activeBlock.startTime) / activeBlock.duration
            ));

            // Render the React component to SVG, then draw to canvas
            await renderBlockToCanvas(
              ctx, container, Renderer, blockProgress, width, height, activeBlock.config
            );
          }
        }

        // Request a frame from the canvas stream
        const track = stream.getVideoTracks()[0] as any;
        if (track?.requestFrame) {
          track.requestFrame();
        }

        setProgress((frame + 1) / totalFrames);

        // Yield to keep UI responsive
        if (frame % 2 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    } catch (err) {
      console.error("Video export error:", err);
      setStatus("error");
      document.body.removeChild(container);
      recorder.stop();
      return;
    }

    setStatus("encoding");
    recorder.stop();

    const blob = await recordingDone;
    document.body.removeChild(container);

    // Download
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, "_")}.webm`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus("done");
    setTimeout(() => setStatus("idle"), 2000);
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
    setStatus("idle");
  }, []);

  return { exportVideo, status, progress, cancel };
}

/** Render a block's React component to SVG string, then draw to canvas */
async function renderBlockToCanvas(
  ctx: CanvasRenderingContext2D,
  container: HTMLElement,
  Renderer: React.ComponentType<any>,
  progress: number,
  width: number,
  height: number,
  config?: Record<string, unknown>
) {
  // Render the component to get the SVG markup
  return new Promise<void>((resolve) => {
    // Create a temporary wrapper
    const wrapper = document.createElement("div");
    wrapper.style.cssText = `width:${width}px;height:${height}px;`;
    container.innerHTML = "";
    container.appendChild(wrapper);

    const root = createRoot(wrapper);
    root.render(
      React.createElement(Renderer, { progress, width, height, config })
    );

    // Wait for React to render, then serialize SVG
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const svgEl = wrapper.querySelector("svg");
        if (svgEl) {
          const svgData = new XMLSerializer().serializeToString(svgEl);
          const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(svgBlob);
          const img = new Image();
          img.onload = () => {
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            root.unmount();
            resolve();
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            root.unmount();
            resolve();
          };
          img.src = url;
        } else {
          root.unmount();
          resolve();
        }
      });
    });
  });
}
