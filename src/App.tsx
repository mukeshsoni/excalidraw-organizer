import { useEffect, useRef, useState } from "react";
import { AppState } from "@excalidraw/excalidraw/types/types";
import {
  Stack,
  Button,
  Drawer,
  NavLink,
  Modal,
  Input,
  Group,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";

import "./App.css";

const canvasListKey = "excalidraw-organizer-canvas-list";
const panelVisibilityKey = "excalidraw-organizer-show-panel";
function App() {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [canvases, setCanvases] = useState<Array<{ id: string; name: string }>>(
    [],
  );
  const [showPanel, setShowPanel] = useState(false);
  const [opened, { open: openNameSaveModal, close: closeNameSaveModal }] =
    useDisclosure(false);

  useEffect(() => {
    const show = JSON.parse(
      localStorage.getItem(panelVisibilityKey) || "false",
    );
    console.log({ show });
    setShowPanel(show);
  }, []);
  console.log({ showPanel });
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
        const idNameSeparator = "::::";

        if (!canvasName.includes(idNameSeparator)) {
          const canvasId = Math.random().toString(36).substring(7);
          appState.name = `${canvasId}${idNameSeparator}${canvasName}`;
          console.log("Setting appstate", appState);
          setCanvases((canvases) => [
            ...canvases,
            { id: canvasId, name: canvasName },
          ]);
          localStorage.setItem("excalidraw-state", JSON.stringify(appState));
        }
      } catch (e) {
        console.error("Error getting app state", e);
      }
    }, 4000);
  }, []);
  console.log({ canvases });
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
    console.log("handleSaveAsClick");
    openNameSaveModal();
  };
  const getActiveCanvas = () => {
    const appState = JSON.parse(
      localStorage.getItem("excalidraw-state") || "{}",
    );
    if (appState) {
      const idNameSeparator = "::::";
      const canvasId = appState.name.split(idNameSeparator)[0];
      const canvasName = appState.name.split(idNameSeparator)[1];
      const elements = JSON.parse(localStorage.getItem("excalidraw") || "[]");
      return { appState, canvasId, canvasName, elements };
    }
    return null;
  };

  const handleCanvasItemClick = (canvas: { id: string; name: string }) => {
    // save the existing canvas to local storage
    const currentCanvas = getActiveCanvas();
    if (currentCanvas !== null) {
      localStorage.setItem(
        `excalidraw-organizer-${currentCanvas.canvasId}`,
        JSON.stringify(currentCanvas),
      );
    }

    // Get the canvas for the clicked item
    const canvasData = JSON.parse(
      localStorage.getItem(`excalidraw-organizer-${canvas.id}`) || "{}",
    );
    if (canvasData.canvasId) {
      localStorage.setItem(
        "excalidraw-state",
        JSON.stringify(canvasData.appState),
      );
      localStorage.setItem("excalidraw", JSON.stringify(canvasData.elements));
      window.location.reload();
    } else {
      console.error("Error getting canvas data");
    }
  };
  const isCanvasActive = (canvas: { id: string; name: string }) => {
    const appState = JSON.parse(
      localStorage.getItem("excalidraw-state") || "{}",
    );
    const idNameSeparator = "::::";
    return appState.name.includes(canvas.id + idNameSeparator);
  };
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("name changed to", e.currentTarget.value);
  };
  const handleSaveNameClick = () => {
    // TODO
    if (nameInputRef.current) {
      console.log("name changed to", nameInputRef.current.value);
    }
    closeNameSaveModal();
  };

  return (
    <>
      <Modal
        opened={opened}
        onClose={closeNameSaveModal}
        title="Save as"
        centered
      >
        <Stack gap={12}>
          <Input
            placeholder="Enter name"
            onChange={handleNameChange}
            defaultValue={getActiveCanvas()?.canvasName}
            ref={nameInputRef}
          />
          <Group style={{ flexDirection: "row-reverse" }} gap={8}>
            <Button onClick={handleSaveNameClick}>Save</Button>
            <Button variant="outline" onClick={closeNameSaveModal}>
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>
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
      <Drawer opened={showPanel} onClose={handleDrawerClose}>
        <Stack justify="space-between" h="100%">
          <Stack gap={0}>
            {canvases.map((canvas) => (
              <NavLink
                onClick={handleCanvasItemClick.bind(null, canvas)}
                label={canvas.name}
                active={isCanvasActive(canvas)}
              />
            ))}
          </Stack>
          <Button onClick={handleSaveAsClick}>Save as</Button>
        </Stack>
      </Drawer>
    </>
  );
}

export default App;
