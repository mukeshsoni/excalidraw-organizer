import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { DEFAULT_FOLDER_ID } from "./db";
import { getSceneVersion } from "@excalidraw/excalidraw";

export const LOCAL_STORAGE_KEY_PREFIX = "excalidraw-organizer";
export function getActiveCanvasId() {
  return localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}-active-canvas-id`);
}
export function getActiveCanvas(): {
  id: string;
  name: string;
  elements: Array<ExcalidrawElement>;
  appState: Partial<AppState> & { name: string };
} | null {
  const canvasId = getActiveCanvasId();
  const appState = JSON.parse(localStorage.getItem("excalidraw-state") || "{}");
  // TODO: What if we can't find a canvasId in localstorage?
  if (appState && canvasId) {
    const name = appState.name;
    const elements = JSON.parse(localStorage.getItem("excalidraw") || "[]");
    return { appState, id: canvasId, name, elements };
  }
  return null;
}

export function setCanvasNameInAppState(canvasName: string) {
  const appState = JSON.parse(
    localStorage.getItem("excalidraw-state") || "{}",
  ) as AppState;
  if (appState) {
    appState.name = canvasName;
    localStorage.setItem("excalidraw-state", JSON.stringify(appState));
  }
}
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
    const canvasName = appState.name;
    const canvasId =
      getActiveCanvasId() || Math.random().toString(36).substring(7);

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
    Number(
      localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}-selected-folder-id`),
    ) || DEFAULT_FOLDER_ID
  );
}
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
export function setActiveCanvasId(canvasId: string) {
  localStorage.setItem(
    `${LOCAL_STORAGE_KEY_PREFIX}-active-canvas-id`,
    canvasId,
  );
}
export function setSelectedFolderIdInStorage(folderId: number) {
  localStorage.setItem(
    `${LOCAL_STORAGE_KEY_PREFIX}-selected-folder-id`,
    String(folderId),
  );
}
