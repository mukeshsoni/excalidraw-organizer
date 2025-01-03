import { useCallback, useEffect, useState } from "react";
import { Button, Modal, Flex, Divider } from "@mantine/core";
import { moveCanvasToFolder, saveExistingCanvasToDb } from "./db";

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
import {
  getActiveCanvasSceneVersion,
  getLastSavedSceneVersion,
  getSelectedFolderId,
} from "./helpers";

const panelVisibilityKey = "excalidraw-organizer-show-panel";

function useForceUpdate() {
  const [, setToggle] = useState(false);
  return () => setToggle((toggle) => !toggle);
}
function App() {
  const forceUpdate = useForceUpdate();
  const [showPanel, setShowPanel] = useState(false);
  const db = useDatabase();

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
  const saveActiveCanvasToDb = useCallback(() => {
    if (db) {
      const lastSavedSceneVersion = getLastSavedSceneVersion();
      const sceneVersion = getActiveCanvasSceneVersion();

      if (sceneVersion !== lastSavedSceneVersion) {
        saveExistingCanvasToDb(db);
      }
    } else {
      // TODO
    }
  }, [db]);
  // save the current canvas to db every second
  useEffect(() => {
    const SAVE_INTERVAL = 1000; // 1 second
    let timeoutHandle: number;
    function _saveCanvasToDb() {
      saveActiveCanvasToDb();
      timeoutHandle = setTimeout(_saveCanvasToDb, SAVE_INTERVAL);
    }
    timeoutHandle = setTimeout(_saveCanvasToDb, SAVE_INTERVAL);

    return () => {
      clearTimeout(timeoutHandle);
    };
  }, [saveActiveCanvasToDb]);

  return (
    <>
      {!showPanel ? (
        <Button
          onClick={handlePanelOpenClick}
          variant="transparent"
          style={{
            left: window.innerWidth / 2 - 50,
            padding: 2,
          }}
        >
          Open organizer
        </Button>
      ) : null}
      <Modal
        title="Organizer"
        opened={showPanel && !!db}
        onClose={handleDrawerClose}
        centered
        size={"100%"}
        styles={{
          content: {
            height: "80vh",
            display: "flex",
            flexDirection: "column",
          },
          body: {
            display: "flex",
            flexDirection: "column",
            flex: 1,
          },
        }}
      >
        <Flex style={{ flex: 1 }}>
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

export default App;
