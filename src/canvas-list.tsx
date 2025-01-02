import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Button,
  Flex,
  Group,
  Input,
  Modal,
  Select,
  Stack,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { IconPlus } from "@tabler/icons-react";
import { useDatabase } from "./DbProvider";
import {
  createNewCanvas,
  DEFAULT_FOLDER_ID,
  ExcalidrawOrganizerDB,
  getCanvasFromDb,
  getFolders,
  saveExistingCanvasToDb,
  updateFolderWithCanvas,
} from "./db";
import { getSelectedFolderId } from "./helpers";
import { ExcalidrawPreview } from "./preview";

export function CanvasList() {
  const [showNewCanvasNameModal, setShowNewCanvasNameModal] = useState(false);
  const [canvases, setCanvases] = useState<
    ExcalidrawOrganizerDB["canvas"]["value"][]
  >([]);
  const db = useDatabase();
  const { data: folders } = useQuery({
    queryKey: ["folders"],
    queryFn: () => getFolders(db),
    enabled: !!db,
  });
  const selectedFolderId = getSelectedFolderId();
  useEffect(() => {
    async function getCanvases() {
      const folder = folders?.find((folder) => folder.id === selectedFolderId);
      if (db && folder) {
        const canvasesFromDb = [];
        for (const canvas of folder.canvases) {
          const canvasFromDb = await getCanvasFromDb(db, canvas.canvasId);
          if (canvasFromDb) {
            canvasesFromDb.push(canvasFromDb);
          }
        }
        setCanvases(canvasesFromDb);
      }
    }
    getCanvases();
  }, [selectedFolderId, folders, db]);

  function handleNewCanvasClick() {
    setShowNewCanvasNameModal(true);
  }
  const handleNewCanvasNameModalClose = () => {
    setShowNewCanvasNameModal(false);
  };
  const handleNewCanvasSubmit = async (name: string, folderId: number) => {
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
      localStorage.setItem("excalidraw-organizer-show-panel", "false");
      // 5. Reload the page
      window.location.reload();
    }
    setShowNewCanvasNameModal(false);
  };
  const handleCanvasItemClick = async (id: string) => {
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
        localStorage.setItem("excalidraw-organizer-show-panel", "false");
        window.location.reload();
      } else {
        console.error("Error getting canvas data");
      }
    } else {
      // TODO
    }
  };

  return (
    <Stack style={{ flex: 1 }} p="sm">
      <Flex direction="row-reverse">
        <Button onClick={handleNewCanvasClick} rightSection={<IconPlus />}>
          New Canvas
        </Button>
      </Flex>
      <Flex gap="sm" wrap="wrap">
        {canvases.map((canvas) => (
          <CanvasItem
            key={canvas.id}
            canvas={canvas}
            onItemClick={handleCanvasItemClick}
          />
        ))}
      </Flex>
      {showNewCanvasNameModal && folders ? (
        <NewCanvasModal
          folders={folders}
          onClose={handleNewCanvasNameModalClose}
          onSubmit={handleNewCanvasSubmit}
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
        <Input placeholder="Enter name" ref={nameInputRef} data-autofocus />
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

type CanvasItemProps = {
  canvas: ExcalidrawOrganizerDB["canvas"]["value"];
  onItemClick: (id: string) => void;
};
function CanvasItem({ canvas, onItemClick }: CanvasItemProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: canvas.id,
  });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  return (
    <UnstyledButton
      key={canvas.id}
      style={{
        border: "1px solid #dfdada",
        borderRadius: 10,
        padding: 10,
        ...style,
      }}
      onClick={onItemClick.bind(null, canvas.id)}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      <ExcalidrawPreview
        data={{
          elements: canvas.elements,
          appState: { viewBackgroundColor: "#fff" },
          files: {},
        }}
        width={window.innerWidth / 5}
        height={window.innerWidth / 5 - 40}
        withBackground={true}
      />
      <Text size="xs">{canvas.name}</Text>
    </UnstyledButton>
  );
}
