import { useEffect, useRef, useState } from "react";
import { DBSchema, IDBPDatabase, openDB } from "idb";
import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import { AppState } from "@excalidraw/excalidraw/types/types";
import {
  Stack,
  Button,
  Modal,
  Input,
  Group,
  Tree,
  Container,
  useMantineTheme,
  Flex,
  CloseButton,
  Select,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import classes from "./App.module.css";

import "./App.css";

const canvasListKey = "excalidraw-organizer-canvas-list";
const panelVisibilityKey = "excalidraw-organizer-show-panel";

interface ExcalidrawOrganizerDB extends DBSchema {
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

function getCurrentCanvasDetails(): {
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
async function getCanvasFromDb(
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

async function getFolderByName(
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
const DEFAULT_FOLDER_NAME = "Default";
const idNameSeparator = "::::";

async function initializeDB() {
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
        id: 1,
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

async function getFolders(
  db: IDBPDatabase<ExcalidrawOrganizerDB>,
): Promise<ExcalidrawOrganizerDB["folder"]["value"][]> {
  return db.getAll("folder");
}
function isCanvasActive(canvas: { id: string; name: string }) {
  const appState = JSON.parse(localStorage.getItem("excalidraw-state") || "{}");
  return appState.name.includes(canvas.id + idNameSeparator);
}
const getActiveCanvas = (): {
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
async function saveExistingCanvasToDb(db: IDBPDatabase<ExcalidrawOrganizerDB>) {
  // save the existing canvas to local storage
  const currentCanvas = getActiveCanvas();
  if (currentCanvas) {
    await db.put("canvas", currentCanvas);
  }
}
async function createNewCanvas(
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
async function updateFolderWithCanvas(
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

function App() {
  const theme = useMantineTheme();
  const [db, setDb] = useState<IDBPDatabase<ExcalidrawOrganizerDB> | null>(
    null,
  );
  const [folders, setFolders] = useState<
    ExcalidrawOrganizerDB["folder"]["value"][]
  >([]);
  console.log({ folders });
  const [canvases, setCanvases] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [showPanel, setShowPanel] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showNewCanvasNameModal, setShowNewCanvasNameModal] = useState(false);

  // initialize the db
  useEffect(() => {
    setTimeout(() => {
      initializeDB()
        .then(setDb)
        .catch((e) => {
          console.error("Error initializing db: ", e);
        });
      // TODO: This is a hack to ensure that we initialize db with
      // correct current canvas details. We should instead wait for something
      // to happen which tells us that excalidraw has initialized the canvas
    }, 1000);
  }, [setDb]);
  // Once we initialize the db, get the folders and canvases
  useEffect(() => {
    if (db) {
      getFolders(db).then(setFolders);
    }
  }, [db]);

  useEffect(() => {
    const show = JSON.parse(
      localStorage.getItem(panelVisibilityKey) || "false",
    );
    setShowPanel(show);
  }, []);
  useEffect(() => {
    // @ts-expect-error abc
    chrome.runtime.onMessage.addListener(
      // @ts-expect-error abc
      function (message) {
        if (message.message === "toggle-panel") {
          setShowPanel((sp) => {
            localStorage.setItem(panelVisibilityKey, JSON.stringify(!sp));
            return !sp;
          });
        }
      },
    );
  }, []);

  useEffect(() => {
    try {
      const canvases = JSON.parse(localStorage.getItem(canvasListKey) || "[]");
      if (!canvases) {
        localStorage.setItem(canvasListKey, JSON.stringify([]));
      }
      setCanvases(canvases || []);
    } catch (e) {
      console.error("Error parsing canvases", e);
    }

    setTimeout(() => {
      try {
        const appState = JSON.parse(
          localStorage.getItem("excalidraw-state") || "",
        ) as AppState;
        const canvasName = appState.name;

        if (!canvasName.includes(idNameSeparator)) {
          const canvasId = Math.random().toString(36).substring(7);
          appState.name = `${canvasId}${idNameSeparator}${canvasName}`;
          setCanvases((canvases) => [
            ...canvases,
            { id: canvasId, name: canvasName },
          ]);
          localStorage.setItem("excalidraw-state", JSON.stringify(appState));
        }
      } catch (e) {
        console.error("Error getting app state", e);
      }
    }, 2000);
  }, []);
  useEffect(() => {
    localStorage.setItem(canvasListKey, JSON.stringify(canvases));
  }, [canvases]);

  const handleDrawerClose = () => {
    setShowPanel(false);
    localStorage.setItem(panelVisibilityKey, JSON.stringify(false));
  };
  const handlePanelOpenClick = () => {
    setShowPanel(true);
    localStorage.setItem(panelVisibilityKey, JSON.stringify(true));
  };

  const handleSaveAsClick = () => {
    setShowRenameModal(true);
  };

  const handleCanvasItemClick = async ({
    id,
    name,
  }: {
    id: string;
    name: string;
  }) => {
    if (db) {
      await saveExistingCanvasToDb(db);
      // Get the canvas for the clicked item
      const canvas = await getCanvasFromDb(db, id);
      if (canvas) {
        localStorage.setItem(
          "excalidraw-state",
          JSON.stringify(canvas.appState),
        );
        localStorage.setItem("excalidraw", JSON.stringify(canvas.elements));
        window.location.reload();
      } else {
        console.error("Error getting canvas data");
      }
    } else {
      // TODO
    }
  };
  async function getCanvases() {
    if (db) {
      const canvases = await db.getAll("canvas");
      console.log({ canvases });
      const canvas = await db.get("canvas", IDBKeyRange.only(1));
      console.log({ canvas });
    }
  }
  function handleNewCanvasClick() {
    setShowNewCanvasNameModal(true);
  }
  function getFolderTreeData() {
    const folderTreeData = folders.map((folder) => ({
      label: folder.name,
      value: folder.name,
      children: folder.canvases.map((canvas) => ({
        label: canvas.canvasName,
        value: canvas.canvasId,
      })),
    }));
    console.log({ folderTreeData });
    return folderTreeData;
  }
  const handleNewCanvasNameModalClose = () => {
    setShowRenameModal(false);
  };
  const handleNewCanvasNameChange = async (name: string, folderId: number) => {
    // TODO
    if (db) {
      // 1. save existing canvas data
      await saveExistingCanvasToDb(db);
      // 2. create a new canvas with some name and id and store in db
      const canvas = await createNewCanvas(db, name);
      // 3. update the folder with the new canvas
      // Probably show a dropdown of folder names in the name modal
      await updateFolderWithCanvas(db, folderId, canvas);
      // 4. Update excalidraw and excalidraw-state local storage
      localStorage.setItem("excalidraw-state", JSON.stringify(canvas.appState));
      localStorage.setItem("excalidraw", JSON.stringify(canvas.elements));
      // 5. Reload the page
      window.location.reload();
      console.log("name changed to", name);
    }
    setShowNewCanvasNameModal(false);
  };
  const handleRenameModalClose = () => {
    setShowRenameModal(false);
  };
  const handleRenameChange = (name: string) => {
    console.log("name changed to", name);
    setShowRenameModal(false);
  };

  const defaultValue = getActiveCanvas()?.canvasName;

  return (
    <>
      {showNewCanvasNameModal ? (
        <NewCanvasModal
          folders={folders}
          onClose={handleNewCanvasNameModalClose}
          onSubmit={handleNewCanvasNameChange}
        />
      ) : null}
      {showRenameModal ? (
        <NameModal
          defaultValue={defaultValue}
          onClose={handleRenameModalClose}
          onNameChange={handleRenameChange}
        />
      ) : null}
      {!showPanel ? (
        <Button
          onClick={handlePanelOpenClick}
          variant="transparent"
          style={{
            transform: "rotate(-90deg)",
            top: 300,
            left: -30,
            height: 19,
            padding: 2,
          }}
        >
          Open panel
        </Button>
      ) : null}
      {showPanel && db ? (
        <Container
          style={{
            width: 300,
            background: theme.colors.gray[1],
            height: "100vh",
            padding: 0,
          }}
        >
          <Flex justify="flex-end" py={2} px={1}>
            <CloseButton onClick={handleDrawerClose} variant="transparent" />
          </Flex>
          <Stack gap={0}>
            <Tree data={getFolderTreeData()} />
            <Button onClick={handleSaveAsClick}>Save as</Button>
            <Button onClick={getCanvases}>Get canvases from idb</Button>
            <Button onClick={handleNewCanvasClick}>Create new canvas</Button>
          </Stack>
        </Container>
      ) : null}
    </>
  );
}

type NameModalProps = {
  defaultValue?: string;
  onClose: () => void;
  onNameChange: (name: string) => void;
};

function NameModal({ defaultValue, onClose, onNameChange }: NameModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("name changed to", e.currentTarget.value);
  };
  const handleSaveNameClick = () => {
    // TODO
    if (nameInputRef.current) {
      console.log("name changed to", nameInputRef.current.value);
      onNameChange(nameInputRef.current.value);
    }
  };
  return (
    <Modal
      opened={true}
      onClose={onClose}
      title="Save as"
      centered
      style={{ zIndex: 10000 }}
    >
      <Stack gap={12}>
        <Input
          placeholder="Enter name"
          onChange={handleNameChange}
          defaultValue={defaultValue}
          ref={nameInputRef}
        />
        <Group style={{ flexDirection: "row-reverse" }} gap={8}>
          <Button onClick={handleSaveNameClick}>Save</Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
type NewCanvasModalProps = {
  onClose: () => void;
  folders: Array<{ id: number; name: string }>;
  onSubmit: (name: string, folderId: number) => void;
};
function NewCanvasModal({ onClose, folders, onSubmit }: NewCanvasModalProps) {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("name changed to", e.currentTarget.value);
  };
  function getDefaultFolderId() {
    return (
      folders
        .find((folder) => folder.name === DEFAULT_FOLDER_NAME)
        ?.id.toString() || "1"
    );
  }
  const handleCreateClick = () => {
    // TODO
    if (nameInputRef.current) {
      console.log(
        "name changed to",
        nameInputRef.current.value,
        selectedFolder,
      );
      onSubmit(
        nameInputRef.current.value,
        Number(selectedFolder || getDefaultFolderId()),
      );
    }
  };
  const handleFolderChange = (value: string | null) => {
    setSelectedFolder(value);
  };
  console.log({ folders });
  return (
    <Modal
      opened={true}
      onClose={onClose}
      title="Save as"
      centered
      style={{ zIndex: 10000 }}
    >
      <Stack gap={12}>
        <Input
          placeholder="Enter name"
          onChange={handleNameChange}
          ref={nameInputRef}
        />
        <Select
          onChange={handleFolderChange}
          label="Select folder"
          placeholder="Select folder"
          data={folders.map((folder) => ({
            label: folder.name,
            value: `${folder.id}`,
          }))}
        />

        <Group style={{ flexDirection: "row-reverse" }} gap={8}>
          <Button onClick={handleCreateClick}>Create</Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export default App;
