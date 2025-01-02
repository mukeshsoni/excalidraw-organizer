import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { DEFAULT_FOLDER_ID, idNameSeparator } from "./db";
import { getSceneVersion } from "@excalidraw/excalidraw";

export const getActiveCanvas = (): {
  id: string;
  name: string;
  elements: Array<ExcalidrawElement>;
  appState: Partial<AppState> & { name: string };
} | null => {
  const appState = JSON.parse(localStorage.getItem("excalidraw-state") || "{}");
  if (appState) {
    const id = appState.name.split(idNameSeparator)[0];
    const name = appState.name.split(idNameSeparator)[1];
    const elements = JSON.parse(localStorage.getItem("excalidraw") || "[]");
    return { appState, id, name, elements };
  }
  return null;
};

export function getCurrentCanvasDetails(): {
  canvasId: string;
  canvasName: string;
  appState: Partial<AppState> & { name: string };
  elements: Array<ExcalidrawElement>;
} {
  try {
    const appState = JSON.parse(
      localStorage.getItem("excalidraw-state") || "{}",
    ) as AppState;
    let canvasName = appState.name;
    const nameParts = canvasName.split(idNameSeparator);

    let canvasId = "";
    if (nameParts.length === 2) {
      canvasId = nameParts[0];
      canvasName = nameParts[1];
    }

    // We change the appState.name to include the canvas id if it doesn't already
    // We add a separator to the name to separate the id and the name
    // That's because we need some way to identify the currently active canvas
    // and we can't rely on the name alone as it can be duplicated across canvases
    if (canvasId) {
      canvasId = Math.random().toString(36).substring(7);
      appState.name = `${canvasId}${idNameSeparator}${canvasName}`;
      localStorage.setItem("excalidraw-state", JSON.stringify(appState));
    }

    const elements = JSON.parse(localStorage.getItem("excalidraw") || "[]");
    return {
      canvasId,
      canvasName,
      appState,
      elements,
    };
  } catch (e) {
    console.error("Error getting current canvas details", e);
    // TODO: What happens if we realize the localstorage for current canvas is corrupted
    // or does not exist?
    return {
      canvasId: Math.random().toString(36).substring(7),
      canvasName: "canvas 1",
      appState: {
        name: "canvas 1",
      },
      elements: [],
    };
  }
}
export function getSelectedFolderId() {
  return (
    Number(localStorage.getItem("excalidraw-organizer-selected-folder-id")) ||
    DEFAULT_FOLDER_ID
  );
}
const LOCAL_STORAGE_KEY_PREFIX = "excalidraw-organizer";
export function getLastSavedSceneVersion(): number {
  return (
    Number(
      localStorage.getItem(
        `${LOCAL_STORAGE_KEY_PREFIX}-last-saved-scene-version`,
      ),
    ) || 0
  );
}
export function getActiveCanvasSceneVersion(): number {
  const elements = JSON.parse(
    localStorage.getItem("excalidraw") || "[]",
  ) as ExcalidrawElement[];
  return getSceneVersion(elements);
}
export function setLastSavedSceneVersion() {
  localStorage.setItem(
    `${LOCAL_STORAGE_KEY_PREFIX}-last-saved-scene-version`,
    JSON.stringify(getActiveCanvasSceneVersion()),
  );
}
