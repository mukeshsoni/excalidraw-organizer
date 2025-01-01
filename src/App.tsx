import { useEffect, useRef, useState } from "react";
import { IDBPDatabase } from "idb";
import { AppState } from "@excalidraw/excalidraw/types/types";
import {
  Stack,
  Button,
  Modal,
  Input,
  Group,
  Tree,
  useMantineTheme,
  Select,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import classes from "./App.module.css";
import {
  idNameSeparator,
  initializeDB,
  getFolders,
  saveExistingCanvasToDb,
  getCanvasFromDb,
  createNewCanvas,
  updateFolderWithCanvas,
  DEFAULT_FOLDER_NAME,
  ExcalidrawOrganizerDB,
} from "./db";
import { getActiveCanvas } from "./helpers";

import "./App.css";

const canvasListKey = "excalidraw-organizer-canvas-list";
const panelVisibilityKey = "excalidraw-organizer-show-panel";

function isCanvasActive(canvas: { id: string; name: string }) {
  const appState = JSON.parse(localStorage.getItem("excalidraw-state") || "{}");
  return appState.name.includes(canvas.id + idNameSeparator);
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
      <Modal
        opened={showPanel && !!db}
        onClose={handleDrawerClose}
        centered
        size={"100%"}
      >
        <Stack gap={0}>
          <Tree data={getFolderTreeData()} />
          <Button onClick={handleSaveAsClick}>Save as</Button>
          <Button onClick={getCanvases}>Get canvases from idb</Button>
          <Button onClick={handleNewCanvasClick}>Create new canvas</Button>
        </Stack>
      </Modal>
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
