import { useRef, useState } from "react";
import {
  Button,
  Flex,
  Group,
  Input,
  Modal,
  Select,
  Stack,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { useDatabase } from "./DbProvider";
import {
  createNewCanvas,
  DEFAULT_FOLDER_ID,
  getFolders,
  saveExistingCanvasToDb,
  updateFolderWithCanvas,
} from "./db";
import { getSelectedFolderId } from "./helpers";

export function CanvasList() {
  const [showNewCanvasNameModal, setShowNewCanvasNameModal] = useState(false);
  const db = useDatabase();
  const { data: folders } = useQuery({
    queryKey: ["folders"],
    queryFn: () => getFolders(db),
    enabled: !!db,
  });
  console.log("CanvasList: folders: ", folders);
  const selectedFolderId = getSelectedFolderId();
  const canvases =
    folders?.find((folder) => folder.id === selectedFolderId)?.canvases || [];
  function handleNewCanvasClick() {
    setShowNewCanvasNameModal(true);
  }
  const handleNewCanvasNameModalClose = () => {
    setShowNewCanvasNameModal(false);
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
    }
    setShowNewCanvasNameModal(false);
  };

  return (
    <Stack style={{ flex: 1 }} p="sm">
      <Flex direction="row-reverse">
        <Button onClick={handleNewCanvasClick}>New Canvas</Button>
      </Flex>
      <Stack>
        {canvases.map((canvas) => {
          return <div key={canvas.canvasId}>{canvas.canvasName}</div>;
        })}
      </Stack>
      {showNewCanvasNameModal && folders ? (
        <NewCanvasModal
          folders={folders}
          onClose={handleNewCanvasNameModalClose}
          onSubmit={handleNewCanvasNameChange}
        />
      ) : null}
    </Stack>
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
  function getDefaultFolderId() {
    return (
      folders
        .find((folder) => folder.id === DEFAULT_FOLDER_ID)
        ?.id.toString() || "1"
    );
  }
  const handleCreateClick = () => {
    if (nameInputRef.current) {
      onSubmit(
        nameInputRef.current.value,
        Number(selectedFolder || getDefaultFolderId()),
      );
    }
  };
  const handleFolderChange = (value: string | null) => {
    setSelectedFolder(value);
  };

  return (
    <Modal opened={true} onClose={onClose} title="Create new canvas" centered>
      <Stack gap={12}>
        <Input placeholder="Enter name" ref={nameInputRef} />
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
