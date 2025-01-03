import * as React from "react";
import { useRef, useEffect } from "react";
import { render } from "react-dom";
import { exportToCanvas } from "@excalidraw/excalidraw";
import { AppState, BinaryFiles } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";

import BlankCanvasGraphics from "./blank-canvas-preview-graphics";

// copied from excalidraw code
export const canvasToBlob = async (
  canvas: HTMLCanvasElement,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          return reject(new Error("canvasError.canvasTooBig"));
        }
        resolve(blob);
      });
    } catch (error) {
      reject(error);
    }
  });
};

function ErrorCanvasPreview() {
  return <div>{"canvas_preview_error"}</div>;
}

function renderPreview(
  content: HTMLCanvasElement | Error,
  previewNode: HTMLDivElement,
) {
  previewNode.innerHTML = "";
  if (content instanceof HTMLCanvasElement) {
    previewNode.appendChild(content);
  } else {
    render(<ErrorCanvasPreview />, previewNode);
  }
}

type Props = {
  darkMode?: boolean;
  withBackground?: boolean;
  data: {
    elements: readonly ExcalidrawElement[];
    appState: Partial<AppState>;
    files?: BinaryFiles;
  };
  width?: number;
  height?: number;
};

export function ExcalidrawPreview({
  data: { elements, appState, files },
  darkMode = false,
  withBackground = false,
  width = 200,
  height = 200,
}: Props): React.ReactElement {
  const previewRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const previewNode = previewRef.current;
    if (previewNode && elements.length > 0) {
      try {
        const previewWidth = width;
        exportToCanvas({
          files: files ? files : null,
          elements,
          appState: {
            ...appState,
            exportWithDarkMode: darkMode,
            exportBackground: withBackground,
          },
          getDimensions: (width) => {
            return {
              width: previewWidth,
              height: height,
              // we take the original width of canvas and scale it down to fit
              // our box
              // Adding 20 pixels to canvas width to provide some padding to the
              // preview. Otherwise some part of the preview gets clipped at
              // edges sometimes.
              scale: previewWidth / (width + 20),
            };
          },
        })
          .then((canvas) => {
            // if converting to blob fails, there's some problem that will
            // likely prevent preview and export (e.g. canvas too big)
            canvasToBlob(canvas)
              .then(() => {
                renderPreview(canvas, previewNode);
              })
              .catch((error) => {
                console.error("Error trying to convert canvas to blog", error);
                renderPreview(
                  new Error("Error trying to convert canvas to blog"),
                  previewNode,
                );
              });
          })
          // eslint-disable-next-line
          .catch((e: any) => {
            console.log("Error exporting to canvas", e);
          });
      } catch (e) {
        console.error("Error trying to convert excalidraw data to canvas", e);
        renderPreview(
          new Error("Error trying to convert excalidraw data to canvas"),
          previewNode,
        );
      }
    }
  }, [width, darkMode, withBackground, elements, appState, files, height]);

  if (elements.length === 0) {
    return (
      <div
        style={{
          width,
          height,
          background: "#444444",
        }}
      >
        <BlankCanvasGraphics />
      </div>
    );
  }

  return (
    <div
      style={{
        width,
        height,
      }}
      ref={previewRef}
    />
  );
}
