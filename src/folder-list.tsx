import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionIcon,
  Button,
  Flex,
  Group,
  Input,
  Menu,
  Modal,
  rem,
  Stack,
  Text,
  UnstyledButton,
  useMantineTheme,
} from "@mantine/core";
import {
  IconDotsVertical,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import { useDroppable } from "@dnd-kit/core";

import { useDatabase } from "./DbProvider";
import {
  getFolders,
  createNewFolder,
  DEFAULT_FOLDER_ID,
  ExcalidrawOrganizerDB,
  updateFolderName,
  deleteFolder,
} from "./db";
import classes from "./folder-list.module.css";
import { getSelectedFolderId, setSelectedFolderIdInStorage } from "./helpers";
import { NameModal } from "./rename-canvas";

type Folder = ExcalidrawOrganizerDB["folder"]["value"];
export default function FolderList({
  forceUpdate,
}: {
  forceUpdate: () => void;
}) {
  const [showNewFolderNameModal, setShowNewFolderNameModal] = useState(false);
  const [folderToRename, setFolderToRename] = useState<Folder | null>(null);
  const [folderIdToDelete, setFolderIdToDelete] = useState<number | null>(null);

  const db = useDatabase();
  const queryClient = useQueryClient();

  const { data: folders, refetch } = useQuery({
    queryKey: ["folders"],
    queryFn: () => getFolders(db),
    enabled: !!db,
  });
  function handleNewFolderClick() {
    setShowNewFolderNameModal(true);
  }
  const handeNewFolderModalClose = () => {
    setShowNewFolderNameModal(false);
  };
  const handleNewFolderSubmit = async (name: string) => {
    if (db && name) {
      await createNewFolder(db, name);
      refetch();
    } else {
      // TODO
    }
    setShowNewFolderNameModal(false);
  };
  function handleSelectFolderClick(id: number) {
    setSelectedFolderIdInStorage(id);
    queryClient.invalidateQueries({ queryKey: ["folders"] });
    // Force updating from the top because otherwise the canvases for
    // the selected folders won't get updated
    // Simply invalidating the query won't trigger a re-render
    // Invalidating a query only makes sure that a refetch is triggered
    // if the hook is called again
    forceUpdate();
  }
  const selectedFolderId = getSelectedFolderId();
  function handleFolderRenameClick(folder: Folder) {
    setFolderToRename(folder);
  }
  function handleFolderDeleteClick(id: number) {
    setFolderIdToDelete(id);
  }
  function handleRenameModalClose() {
    setFolderToRename(null);
  }
  function handleDeleteConfirmationDialogClose() {
    setFolderIdToDelete(null);
  }
  async function handleDeleteConfirmation() {
    if (folderIdToDelete === DEFAULT_FOLDER_ID) {
      alert("Cannot delete the default folder");
      return;
    }

    // TODO: What if the active canvas is in the folder to delete?
    if (folderIdToDelete && db) {
      try {
        await deleteFolder(db, folderIdToDelete);
        if (folderIdToDelete === getSelectedFolderId()) {
          setSelectedFolderIdInStorage(DEFAULT_FOLDER_ID);
        }
        // set the default folder as selected if this was the selected folder
        queryClient.invalidateQueries({ queryKey: ["folders"] });
        forceUpdate();
      } catch (e) {
        console.error("Error deleting folder", e);
        alert(e);
      }
      setFolderIdToDelete(null);
    }
  }

  async function handleCanvasRenameSubmit(name: string) {
    if (db && folderToRename) {
      try {
        await updateFolderName(db, folderToRename.id, name);
        queryClient.invalidateQueries({ queryKey: ["folders"] });
      } catch (e) {
        console.error("Error renaming folder", e);
      }
      setFolderToRename(null);
    }
  }

  return (
    <>
      <Stack style={{ minWidth: window.innerWidth / 5 }}>
        <Flex align="center" justify="space-between" px="xs">
          <Text>Folders</Text>
          <ActionIcon
            onClick={handleNewFolderClick}
            aria-label="New Folder"
            variant="light"
            title="New Folder"
          >
            <IconPlus fill="none" />
          </ActionIcon>
        </Flex>
        <Stack gap={0}>
          {folders?.map((folder) => (
            <DroppableFolderItem
              folder={folder}
              selectedFolderId={selectedFolderId}
              onItemClick={handleSelectFolderClick}
              onRename={handleFolderRenameClick}
              onDelete={handleFolderDeleteClick}
            />
          ))}
        </Stack>
        {showNewFolderNameModal && folders ? (
          <NewFolderModal
            onClose={handeNewFolderModalClose}
            onSubmit={handleNewFolderSubmit}
          />
        ) : null}
      </Stack>
      {folderToRename ? (
        <NameModal
          title="Rename folder"
          defaultValue={folderToRename.name}
          onClose={handleRenameModalClose}
          onSubmit={handleCanvasRenameSubmit}
        />
      ) : null}
      <Modal
        opened={!!folderIdToDelete}
        title="Delete Canvas"
        onClose={handleDeleteConfirmationDialogClose}
        centered
      >
        <Stack>
          <Text>
            Are you sure you want to delete the folder? All the canvases inside
            the folder will also be deleted.
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
    </>
  );
}

type NewFolderModalProps = {
  onClose: () => void;
  onSubmit: (name: string) => void;
};
function NewFolderModal({ onClose, onSubmit }: NewFolderModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const handleCreateClick = () => {
    if (nameInputRef.current) {
      onSubmit(nameInputRef.current.value);
    }
  };
  return (
    <Modal opened={true} onClose={onClose} title="New Folder" centered>
      <Stack gap={12}>
        <Input
          placeholder="Enter folder name"
          ref={nameInputRef}
          data-autofocus
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

type DroppableFolderItemProps = {
  folder: Folder;
  selectedFolderId: number;
  onItemClick: (id: number) => void;
  onRename: (folder: Folder) => void;
  onDelete: (id: number) => void;
};
function DroppableFolderItem({
  folder,
  selectedFolderId,
  onItemClick,
  onRename,
  onDelete,
}: DroppableFolderItemProps) {
  const { isOver, setNodeRef } = useDroppable({ id: folder.id });
  const theme = useMantineTheme();

  let color = theme.colors.gray[9];
  let backgroundColor = theme.colors.gray[0];
  if (selectedFolderId === folder.id) {
    color = theme.colors.gray[0];
    backgroundColor = theme.colors.blue[7];
  }
  if (isOver) {
    backgroundColor = theme.colors.blue[3];
    color = theme.colors.gray[9];
  }
  if (isOver && selectedFolderId === folder.id) {
    backgroundColor = theme.colors.indigo[5];
    color = theme.colors.gray[9];
  }
  function handleRenameClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onRename(folder);
  }
  function handleDeleteClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    onDelete(folder.id);
  }
  const selected = selectedFolderId === folder.id;

  return (
    <Group
      justify="space-between"
      ref={setNodeRef}
      className={classes.item}
      style={{
        color,
        backgroundColor,
      }}
      data-active={selected || undefined}
      px="xs"
      key={folder.id}
    >
      <UnstyledButton
        onClick={onItemClick.bind(null, folder.id)}
        style={{
          flex: 1,
        }}
      >
        {folder.name}
      </UnstyledButton>
      {folder.id !== DEFAULT_FOLDER_ID ? (
        <Menu>
          <Menu.Target>
            <ActionIcon
              variant="transparent"
              color={selected ? "white" : "black"}
              size="xs"
              aria-label="Show folder actions"
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
            {folder.id !== DEFAULT_FOLDER_ID ? (
              <Menu.Item
                leftSection={
                  <IconTrash style={{ width: rem(14), height: rem(14) }} />
                }
                onClick={handleDeleteClick}
              >
                Delete
              </Menu.Item>
            ) : null}
          </Menu.Dropdown>
        </Menu>
      ) : null}
    </Group>
  );
}
