import { DBSchema, IDBPDatabase, openDB } from "idb";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";
import {
  getActiveCanvas,
  getActiveCanvasId,
  getSelectedFolderId,
  getCurrentCanvasDetails,
  setActiveCanvasId,
  setSelectedFolderIdInStorage,
  setCanvasNameInAppState,
  setLastSavedSceneVersion,
} from "./helpers";

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
      // Will store the ISO string of the time
      created_at: string;
      // Will store the ISO string of the time
      updated_at: string;
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
      // Will store the ISO string of the time
      created_at: string;
      // Will store the ISO string of the time
      updated_at: string;
    };
    indexes: { "canvas-name": string; "canvas-id": string };
  };
}

export const DEFAULT_FOLDER_NAME = "Default";
export const DEFAULT_FOLDER_ID = 1;
// Setup indexed db
// Create a default folder if it doesn't exist
// Add the current excalidraw canvas to the db
// Set active folder and canvas ids in local storage
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
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      console.log("Adding a default folder");
      // TODO: Get the existing excalidraw canvas details and add it to the db
      // Add the id of that canvas to the canvasIds array
      await folderStore.add({
        id: DEFAULT_FOLDER_ID,
        name: DEFAULT_FOLDER_NAME,
        canvases: [{ canvasId, canvasName }],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      setSelectedFolderIdInStorage(DEFAULT_FOLDER_ID);
      setActiveCanvasId(canvasId);
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
  await tx.done;

  return folder;
}
// Update the canvas name in the db. Need to update name inside appState as well.
// Inside canvas in db as well as local storage if the canvas is currently active
export async function updateCanvasName(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  id: string,
  newName: string,
) {
  const canvas = await getCanvasFromDb(db, id);
  if (canvas) {
    const appState = canvas.appState;
    const newAppState = {
      ...appState,
      name: newName,
    };
    const newCanvas = {
      ...canvas,
      // TODO: Now that we store the name properly inside appState, we can remove the name property
      appState: newAppState,
      name: newName,
      updated_at: new Date().toISOString(),
    };
    const activeCanvasId = getActiveCanvasId();
    if (activeCanvasId === id) {
      setCanvasNameInAppState(newName);
    }
    await db.put("canvas", newCanvas);
  }
}
export async function updateCanvasAttribute(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  id: string,
  attrName: string,
  attrValue: string,
) {
  const tx = db.transaction("canvas", "readwrite");
  const canvasStore = tx.objectStore("canvas");
  const canvas = await canvasStore.get(id);
  if (canvas) {
    await db.put("canvas", {
      ...canvas,
      [attrName]: attrValue,
      updated_at: new Date().toISOString(),
    });
  }
  await tx.done;
}
export async function saveExistingCanvasToDb(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
) {
  // save the existing canvas to local storage
  const currentCanvas = getActiveCanvas();

  if (currentCanvas) {
    const tx = db.transaction("canvas", "readwrite");
    const canvasStore = tx.objectStore("canvas");
    const canvas = await canvasStore.get(currentCanvas.id);
    if (canvas) {
      await db.put("canvas", {
        ...canvas,
        elements: currentCanvas.elements,
        appState: currentCanvas.appState,
        updated_at: new Date().toISOString(),
      });
      setLastSavedSceneVersion();
    }
    await tx.done;
  }
}
export async function createNewFolder(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  name: string,
) {
  const folder = {
    name,
    canvases: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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
    name,
  };
  const canvas = {
    id: canvasId,
    name,
    appState,
    elements: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await db.add("canvas", canvas);
  return canvas;
}
export async function updateFolderCanvasDetails(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  folderId: number,
  canvasId: string,
  canvasName: string,
) {
  const folder = await db.get("folder", IDBKeyRange.only(folderId));
  if (folder) {
    const canvases = folder.canvases;
    const newCanvases = canvases.map((canvas) => {
      if (canvas.canvasId === canvasId) {
        return { canvasId, canvasName };
      }
      return canvas;
    });
    await db.put("folder", {
      ...folder,
      canvases: newCanvases,
    });
  }
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
export async function moveCanvasToFolder(
  db: IDBPDatabase<ExcalidrawOrganizerDB> | null,
  fromFolderId: number,
  toFolderId: number,
  canvasId: string,
) {
  if (db) {
    const tx = db.transaction("folder", "readwrite");
    const folderStore = tx.objectStore("folder");
    const toFolder = await folderStore.get(IDBKeyRange.only(toFolderId));
    const fromFolder = await folderStore.get(IDBKeyRange.only(fromFolderId));
    if (toFolder && fromFolder) {
      const canvas = fromFolder.canvases.find(
        (canvas) => canvas.canvasId === canvasId,
      );

      if (canvas) {
        await folderStore.put({
          ...toFolder,
          canvases: toFolder.canvases.concat({
            canvasId,
            canvasName: canvas.canvasName,
          }),
        });
        await folderStore.put({
          ...fromFolder,
          canvases: fromFolder.canvases.filter(
            (canvas) => canvas.canvasId !== canvasId,
          ),
        });
      }
    }
    await tx.done;
  }
}

export async function deleteCanvas(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  id: string,
) {
  const tx = db.transaction(["folder", "canvas"], "readwrite");
  const folderStore = tx.objectStore("folder");
  const canvasStore = tx.objectStore("canvas");
  await canvasStore.delete(id);
  const folderId = getSelectedFolderId();
  // Update canvas list in folder object
  const folder = await folderStore.get(IDBKeyRange.only(folderId));
  if (folder) {
    const canvases = folder.canvases.filter((canvas) => canvas.canvasId !== id);
    folderStore.put({
      ...folder,
      canvases,
    });
  }
  await tx.done;
}
export async function updateFolderName(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  id: number,
  name: string,
) {
  const tx = db.transaction("folder", "readwrite");
  const folderStore = tx.objectStore("folder");
  const folder = await folderStore.get(IDBKeyRange.only(id));
  if (folder) {
    await folderStore.put({
      ...folder,
      name,
      updated_at: new Date().toISOString(),
    });
  }
  await tx.done;
}
export async function deleteFolder(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
  id: number,
) {
  if (id === DEFAULT_FOLDER_ID) {
    throw new Error("Cannot delete default folder");
  }
  const tx = db.transaction(["folder", "canvas"], "readwrite");
  const folderStore = tx.objectStore("folder");
  const canvasStore = tx.objectStore("canvas");

  const folder = await folderStore.get(IDBKeyRange.only(id));
  if (folder) {
    const activeCanvasId = getActiveCanvasId();
    const activeCanvasInFolder = folder.canvases.some(
      (canvas) => canvas.canvasId === activeCanvasId,
    );

    if (activeCanvasInFolder) {
      throw new Error("Cannot delete folder with active canvas");
    }
    // Delete all canvases in the folder
    for (const canvas of folder.canvases) {
      await canvasStore.delete(canvas.canvasId);
    }
    // Delete the folder itself
    await folderStore.delete(IDBKeyRange.only(id));
  }
  await tx.done;
}
