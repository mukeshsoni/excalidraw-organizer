import { useEffect, useState } from "react";
import { AppState } from "@excalidraw/excalidraw/types/types";
import { Button, Modal, Flex, Divider } from "@mantine/core";
import {
  idNameSeparator,
  getFolders,
  ExcalidrawOrganizerDB,
  moveCanvasToFolder,
} from "./db";

import "./App.css";
import { useDatabase } from "./DbProvider";
import FolderList from "./folder-list";
import { CanvasList } from "./canvas-list";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getSelectedFolderId } from "./helpers";

const canvasListKey = "excalidraw-organizer-canvas-list";
const panelVisibilityKey = "excalidraw-organizer-show-panel";

// function isCanvasActive(canvas: { id: string; name: string }) {
//   const appState = JSON.parse(localStorage.getItem("excalidraw-state") || "{}");
//   return appState.name.includes(canvas.id + idNameSeparator);
// }

function useForceUpdate() {
  const [, setToggle] = useState(false);
  return () => setToggle((toggle) => !toggle);
}
function App() {
  const forceUpdate = useForceUpdate();
  console.log("abc");
  // const theme = useMantineTheme();
  const [folders, setFolders] = useState<
    ExcalidrawOrganizerDB["folder"]["value"][]
  >([]);
  console.log({ folders });
  const [canvases, setCanvases] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [showPanel, setShowPanel] = useState(false);
  const db = useDatabase();

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
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    }),
    useSensor(KeyboardSensor),
  );
  const selectedFolderId = getSelectedFolderId();
  const queryClient = useQueryClient();
  const moveToFolderMutation = useMutation({
    mutationFn: ({
      fromFolderId,
      toFolderId,
      canvasId,
    }: {
      fromFolderId: number;
      toFolderId: number;
      canvasId: string;
    }) => moveCanvasToFolder(db, fromFolderId, toFolderId, canvasId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["folders"] });
    },
  });
  async function handleDragEnd(event: DragEndEvent) {
    if (event.over) {
      moveToFolderMutation.mutate({
        fromFolderId: selectedFolderId,
        toFolderId: Number(event.over.id),
        canvasId: String(event.active.id),
      });
    }
  }

  return (
    <>
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
        <Flex>
          <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
            <FolderList forceUpdate={forceUpdate} />
            <Divider orientation="vertical" />
            <CanvasList />
          </DndContext>
        </Flex>
      </Modal>
    </>
  );
}

// type NameModalProps = {
//   defaultValue?: string;
//   onClose: () => void;
//   onNameChange: (name: string) => void;
// };

// function NameModal({ defaultValue, onClose, onNameChange }: NameModalProps) {
//   const nameInputRef = useRef<HTMLInputElement>(null);
//   const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     console.log("name changed to", e.currentTarget.value);
//   };
//   const handleSaveNameClick = () => {
//     // TODO
//     if (nameInputRef.current) {
//       console.log("name changed to", nameInputRef.current.value);
//       onNameChange(nameInputRef.current.value);
//     }
//   };
//   return (
//     <Modal
//       opened={true}
//       onClose={onClose}
//       title="Save as"
//       centered
//       style={{ zIndex: 10000 }}
//     >
//       <Stack gap={12}>
//         <Input
//           placeholder="Enter name"
//           onChange={handleNameChange}
//           defaultValue={defaultValue}
//           ref={nameInputRef}
//         />
//         <Group style={{ flexDirection: "row-reverse" }} gap={8}>
//           <Button onClick={handleSaveNameClick}>Save</Button>
//           <Button variant="outline" onClick={onClose}>
//             Cancel
//           </Button>
//         </Group>
//       </Stack>
//     </Modal>
//   );
// }

export default App;
