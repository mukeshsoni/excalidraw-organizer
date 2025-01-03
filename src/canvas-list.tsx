import { useEffect, useRef, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  ActionIcon,
  Button,
  Divider,
  Flex,
  Group,
  Input,
  Menu,
  Modal,
  rem,
  Select,
  Stack,
  Text,
  UnstyledButton,
  useMantineTheme,
} from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  IconPlus,
  IconDotsVertical,
  IconTrash,
  IconPencil,
  IconSortDescending,
  IconSortAscending,
  IconArrowDown,
  IconCaretDown,
} from "@tabler/icons-react";
import { useDatabase } from "./DbProvider";
import {
  createNewCanvas,
  DEFAULT_FOLDER_ID,
  deleteCanvas,
  ExcalidrawOrganizerDB,
  getCanvasFromDb,
  getFolders,
  saveExistingCanvasToDb,
  updateCanvasName,
  updateFolderCanvasDetails,
  updateFolderWithCanvas,
} from "./db";
import {
  getActiveCanvasId,
  getSelectedFolderId,
  LOCAL_STORAGE_KEY_PREFIX,
  setActiveCanvasId,
} from "./helpers";
import { ExcalidrawPreview } from "./preview";
import { NameModal } from "./rename-canvas";

type Canvas = ExcalidrawOrganizerDB["canvas"]["value"];
export function CanvasList() {
  const [sortBy, setSortBy] = useState<{
    key: "updated_at" | "name";
    order: "asc" | "desc";
  }>({ key: "updated_at", order: "desc" });
  const [showNewCanvasNameModal, setShowNewCanvasNameModal] = useState(false);
  const [canvasToRename, setCanvasToRename] = useState<Canvas | null>(null);
  const [canvasIdToDelete, setCanvasIdToDelete] = useState<string | null>(null);
  const [canvasesFromDb, setCanvasesFromDb] = useState<
    ExcalidrawOrganizerDB["canvas"]["value"][]
  >([]);
  const canvases = canvasesFromDb.sort((a, b) => {
    switch (sortBy.key) {
      case "updated_at":
        return sortBy.order === "asc"
          ? new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          : new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      case "name":
        return sortBy.order === "asc"
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
    }
  });
  const db = useDatabase();
  const queryClient = useQueryClient();
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
        setCanvasesFromDb(canvasesFromDb);
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
      setActiveCanvasId(canvas.id);
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
        // Very important. Otherwise our 1 second save interval will save
        // the new canvas to the old id
        setActiveCanvasId(canvas.id);
        localStorage.setItem(
          `${LOCAL_STORAGE_KEY_PREFIX}-do-not-save-canvas-now`,
          "true",
        );
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
  function handleCanvasRename(canvas: Canvas) {
    setCanvasToRename(canvas);
  }
  function handleCanvasDeleteClick(id: string) {
    const activeCanvasId = getActiveCanvasId();
    if (activeCanvasId === id) {
      alert(
        "Sorry, you can't delete the active canvas. I am trying to figure out how to make that happen.",
      );
    } else {
      setCanvasIdToDelete(id);
    }
  }
  function handleDeleteConfirmationDialogClose() {
    setCanvasIdToDelete(null);
  }
  async function handleDeleteConfirmation() {
    if (db && canvasIdToDelete) {
      await deleteCanvas(db, canvasIdToDelete);
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
    setCanvasIdToDelete(null);
  }
  function handleRenameModalClose() {
    setCanvasToRename(null);
  }
  async function handleCanvasRenameSubmit(name: string) {
    // TODO: Not a good idea to replicate the canvas name in 3 places - canvas itself, inside folder, inside excalidraw appstate
    if (db && canvasToRename) {
      // Update the canvas name in the db. Need to update name inside appState as well.
      // Inside canvas in db as well as local storage if the canvas is currently active
      await updateCanvasName(db, canvasToRename.id, name);
      // Update the canvas name in the folder
      await updateFolderCanvasDetails(
        db,
        getSelectedFolderId(),
        canvasToRename.id,
        name,
      );
      // Refetch folder details
      queryClient.invalidateQueries({ queryKey: ["folders"] });
      // Close the modal
      setCanvasToRename(null);
    }
  }
  function onSortByClick(key: "updated_at" | "name", order: "asc" | "desc") {
    setSortBy({ key, order });
  }
  function getSortButtonLabel() {
    switch (sortBy.key) {
      case "updated_at":
        return sortBy.order === "asc"
          ? "Update time - Asc"
          : "Update time - Desc";
      case "name":
        return sortBy.order === "asc" ? "Name - A-Z" : "Name - Z-A";
    }
  }
  const theme = useMantineTheme();

  return (
    <Stack style={{ flex: 1 }} p="sm">
      <Group justify="space-between">
        <Menu>
          <Menu.Target>
            <Stack gap={2}>
              <Text size="xs">Sort by</Text>
              <Button
                variant="light"
                leftSection={<IconCaretDown fill={theme.colors.blue[6]} />}
                rightSection={
                  sortBy.order === "asc" ? (
                    <IconSortAscending fill="none" />
                  ) : (
                    <IconSortDescending fill="none" />
                  )
                }
              >
                {getSortButtonLabel()}
              </Button>
            </Stack>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item onClick={onSortByClick.bind(null, "updated_at", "asc")}>
              Update time - Asc
            </Menu.Item>
            <Menu.Item onClick={onSortByClick.bind(null, "updated_at", "desc")}>
              Update time - Desc
            </Menu.Item>
            <Menu.Item onClick={onSortByClick.bind(null, "name", "asc")}>
              Name - A-Z
            </Menu.Item>
            <Menu.Item onClick={onSortByClick.bind(null, "name", "desc")}>
              Name - Z-A
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
        <Button onClick={handleNewCanvasClick} rightSection={<IconPlus />}>
          New Canvas
        </Button>
      </Group>
      <Flex gap="sm" wrap="wrap">
        {canvases.map((canvas) => (
          <CanvasItem
            key={canvas.id}
            canvas={canvas}
            onItemClick={handleCanvasItemClick}
            onRename={handleCanvasRename}
            onDelete={handleCanvasDeleteClick}
          />
        ))}
      </Flex>
      <Modal
        opened={!!canvasIdToDelete}
        title="Delete Canvas"
        onClose={handleDeleteConfirmationDialogClose}
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to delete the canvas? This action cannot be
            undone.
          </Text>
          <Group style={{ flexDirection: "row-reverse" }} gap={8}>
            <Button onClick={handleDeleteConfirmation}>Delete</Button>
            <Button
              variant="outline"
              onClick={handleDeleteConfirmationDialogClose}
            >
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>
      {showNewCanvasNameModal && folders ? (
        <NewCanvasModal
          folders={folders}
          onClose={handleNewCanvasNameModalClose}
          onSubmit={handleNewCanvasSubmit}
        />
      ) : null}
      {canvasToRename ? (
        <NameModal
          title="Rename canvas"
          defaultValue={canvasToRename.name}
          onClose={handleRenameModalClose}
          onSubmit={handleCanvasRenameSubmit}
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
  const activeFolderId = getSelectedFolderId();
  const [selectedFolder, setSelectedFolder] = useState<string | null>(
    String(activeFolderId),
  );
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
          defaultValue={activeFolderId.toString()}
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
  canvas: Canvas;
  onItemClick: (id: string) => void;
  onRename: (canvas: Canvas) => void;
  onDelete: (id: string) => void;
};
function CanvasItem({
  canvas,
  onItemClick,
  onRename,
  onDelete,
}: CanvasItemProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: canvas.id,
  });
  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;
  function handleRenameClick() {
    onRename(canvas);
  }
  function handleDeleteClick() {
    onDelete(canvas.id);
  }

  return (
    <Stack
      style={{
        border: "1px solid #dfdada",
        borderRadius: 10,
        padding: 10,
        ...style,
      }}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
    >
      <UnstyledButton
        key={canvas.id}
        onClick={onItemClick.bind(null, canvas.id)}
      >
        <ExcalidrawPreview
          data={{
            elements: canvas.elements,
            appState: { viewBackgroundColor: "#fff" },
            files: {},
          }}
          width={Math.round(window.innerWidth / 5)}
          height={Math.round(window.innerWidth / 5 - 40)}
          withBackground={true}
        />
      </UnstyledButton>
      <Divider />
      <Group justify="space-between" align="center">
        <Stack gap={2}>
          <Text size="xs">{canvas.name}</Text>
          <Text size="xs">
            Updated - {new Date(canvas.updated_at).toLocaleString()}
          </Text>
        </Stack>
        <Menu shadow="md">
          <Menu.Target>
            <ActionIcon
              variant="transparent"
              color="black"
              size="xs"
              aria-label="Show canvas actions"
            >
              <IconDotsVertical />
            </ActionIcon>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={
                <IconPencil style={{ width: rem(14), height: rem(14) }} />
              }
              onClick={handleRenameClick}
            >
              Rename
            </Menu.Item>
            <Menu.Item
              leftSection={
                <IconTrash style={{ width: rem(14), height: rem(14) }} />
              }
              onClick={handleDeleteClick}
            >
              Delete
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
    </Stack>
  );
}
