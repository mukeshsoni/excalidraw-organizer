import { Button, Group, Input, Modal, Stack } from "@mantine/core";
import { useRef } from "react";

type NameModalProps = {
  title: string;
  defaultValue?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
};

export function NameModal({
  title,
  defaultValue,
  onClose,
  onSubmit,
}: NameModalProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const handleSaveNameClick = () => {
    if (nameInputRef.current) {
      onSubmit(nameInputRef.current.value);
    }
  };

  return (
    <Modal
      opened={true}
      onClose={onClose}
      title={title}
      centered
      style={{ zIndex: 10000 }}
    >
      <Stack gap={12}>
        <Input
          placeholder="Enter name"
          defaultValue={defaultValue}
          ref={nameInputRef}
          data-autofocus
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
