import { DBSchema, IDBPDatabase, openDB } from "idb";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { getActiveCanvas, getCurrentCanvasDetails } from "./helpers";

export interface ExcalidrawOrganizerDB extends DBSchema {
  folder: {
    key: string;
    value: {
      id: number;
      name: string;
      // We will cache the canvas name in the folder object
      // Because we cannot just query the canvas name property from
      // indexeddb and have to fetch the whole canvas object
      // which will have elements and can get very very huge
      // This is for rendering the folders with canvases inside them
      canvases: Array<{ canvasId: string; canvasName: string }>;
    };
    indexes: { "folder-name": string; "folder-id": number };
  };
  canvas: {
    key: string;
    value: {
      id: string;
      name: string;
      elements: Array<ExcalidrawElement>;
      appState: Partial<AppState> & { name: string };
    };
    indexes: { "canvas-name": string; "canvas-id": string };
  };
}

export const DEFAULT_FOLDER_NAME = "Default";
export const DEFAULT_FOLDER_ID = 1;
export const idNameSeparator = "::::";
export async function initializeDB() {
  const db = await openDB<ExcalidrawOrganizerDB>("excalidraw-organizer", 1, {
    upgrade(db) {
      console.log("upgrade: Creating folder and canvas tables");
      const folderStore = db.createObjectStore("folder", {
        keyPath: "id",
        autoIncrement: true,
      });
      folderStore.createIndex("folder-name", "name");
      const canvasStore = db.createObjectStore("canvas", {
        keyPath: "id",
      });
      canvasStore.createIndex("canvas-name", "appState.name");
      canvasStore.createIndex("canvas-id", "id");
    },
  });
  console.log("Got db", db);

  const defaultFolder = await getFolderByName(db, DEFAULT_FOLDER_NAME);
  // if the default folder is not present, add it
  if (!defaultFolder) {
    console.log("Did not get folder by name default. Will create one.");
    const tx = db.transaction(["folder", "canvas"], "readwrite");
    try {
      const folderStore = tx.objectStore("folder");
      const canvasStore = tx.objectStore("canvas");
      const { canvasId, canvasName, appState, elements } =
        getCurrentCanvasDetails();
      console.log("Adding the current canvas to our canvas list");
      await canvasStore.add({
        id: canvasId,
        name: canvasName,
        elements,
        appState,
      });

      console.log("Adding a default folder");
      // TODO: Get the existing excalidraw canvas details and add it to the db
      // Add the id of that canvas to the canvasIds array
      await folderStore.add({
        id: DEFAULT_FOLDER_ID,
        name: DEFAULT_FOLDER_NAME,
        canvases: [{ canvasId, canvasName }],
      });
    } catch (e) {
      console.error("Error adding default folder", e);
    } finally {
      await tx.done;
    }
  }

  return db;
}

export async function getFolders(
  db: IDBPDatabase<ExcalidrawOrganizerDB> | null,
): Promise<ExcalidrawOrganizerDB["folder"]["value"][]> {
  if (db) {
    return db.getAll("folder");
  } else {
    return [];
  }
}

export async function getCanvasFromDb(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  canvasId: string,
) {
  const tx = db.transaction("canvas", "readonly");
  const canvasStore = tx.objectStore("canvas");
  const canvas = await canvasStore.get(canvasId);
  console.log({ canvas });
  await tx.done;

  return canvas;
}

export async function getFolderByName(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  name: string,
) {
  const tx = db.transaction("folder", "readonly");
  const folderStore = tx.objectStore("folder");
  const index = folderStore.index("folder-name");
  const folder = await index.get(name);
  console.log({ name, folder });
  await tx.done;

  return folder;
}
export async function saveExistingCanvasToDb(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
) {
  // save the existing canvas to local storage
  const currentCanvas = getActiveCanvas();
  if (currentCanvas) {
    await db.put("canvas", currentCanvas);
  }
}
export async function createNewFolder(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  name: string,
) {
  const folder = {
    name,
    canvases: [],
  };
  // @ts-expect-error abc
  await db.add("folder", folder);
  return folder;
}
export async function createNewCanvas(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  name: string,
) {
  const canvasId = Math.random().toString(36).substring(7);
  const appState = {
    name: `${canvasId}${idNameSeparator}${name}`,
  };
  const canvas = {
    id: canvasId,
    name,
    appState,
    elements: [],
  };
  await db.add("canvas", canvas);
  return canvas;
}
export async function updateFolderWithCanvas(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  folderId: number,
  canvas: { id: string; name: string },
) {
  const folder = await db.get("folder", IDBKeyRange.only(folderId));
  if (folder) {
    await db.put("folder", {
      ...folder,
      canvases: [
        ...folder.canvases,
        { canvasId: canvas.id, canvasName: canvas.name },
      ],
    });
  }
}
