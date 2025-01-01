import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createTheme, MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@mantine/core/styles.css";
import App from "./App.tsx";
import { DatabaseProvider } from "./DbProvider.tsx";

const theme = createTheme({});
const queryClient = new QueryClient();

const root = `excalidraw-organizer-chrome-extension-root`;
createRoot(document.getElementById(root)!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <DatabaseProvider>
          <App />
        </DatabaseProvider>
      </QueryClientProvider>
    </MantineProvider>
  </StrictMode>,
);
