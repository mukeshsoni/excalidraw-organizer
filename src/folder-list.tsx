import { useQuery } from "@tanstack/react-query";
import {
  ActionIcon,
  Button,
  Flex,
  Group,
  Input,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useDatabase } from "./DbProvider";
import { getFolders, createNewFolder } from "./db";
import { useRef, useState } from "react";

export default function FolderList() {
  const [showNewFolderNameModal, setShowNewFolderNameModal] = useState(false);
  const db = useDatabase();
  const { data: folders, refetch } = useQuery({
    queryKey: ["folders"],
    queryFn: () => getFolders(db),
    enabled: !!db,
  });
  console.log({ folders });
  function handleNewFolderClick() {
    setShowNewFolderNameModal(true);
  }
  const handeNewFolderModalClose = () => {
    setShowNewFolderNameModal(false);
  };
  const handleNewFolderSubmit = async (name: string) => {
    console.log("new folder name", name);
    if (db && name) {
      await createNewFolder(db, name);
      refetch();
    }
    setShowNewFolderNameModal(false);
  };

  return (
    <Stack style={{ width: 250 }}>
      <Flex align="center" justify="space-between" px="xs">
        <Text>Folders</Text>
        <ActionIcon
          onClick={handleNewFolderClick}
          aria-label="New Folder"
          variant="light"
        >
          <IconPlus fill="none" />
        </ActionIcon>
      </Flex>
      {folders?.map((folder) => (
        <Flex key={folder.id} px="xs">
          <Text>{folder.name}</Text>
        </Flex>
      ))}
      {showNewFolderNameModal && folders ? (
        <NewFolderModal
          onClose={handeNewFolderModalClose}
          onSubmit={handleNewFolderSubmit}
        />
      ) : null}
    </Stack>
  );
}

type NewFolderModalProps = {
  onClose: () => void;
  onSubmit: (name: string) => void;
};
function NewFolderModal({ onClose, onSubmit }: NewFolderModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("name changed to", e.currentTarget.value);
  };
  const handleCreateClick = () => {
    if (nameInputRef.current) {
      console.log("name changed to", nameInputRef.current.value);
      onSubmit(nameInputRef.current.value);
    }
  };
  return (
    <Modal opened={true} onClose={onClose} title="New Folder" centered>
      <Stack gap={12}>
        <Input
          placeholder="Enter folder name"
          onChange={handleNameChange}
          ref={nameInputRef}
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
