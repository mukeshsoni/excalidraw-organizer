import { createContext, useContext, useEffect, useState } from "react";
import { ExcalidrawOrganizerDB, initializeDB } from "./db";
import { IDBPDatabase } from "idb";

interface DatabaseContextType {
  db: IDBPDatabase<ExcalidrawOrganizerDB> | null;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(
  undefined,
);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<IDBPDatabase<ExcalidrawOrganizerDB> | null>(
    null,
  );

  useEffect(() => {
    async function init() {
      const db = await initializeDB();
      setDb(db);
    }

    init();
  }, []);

  return (
    <DatabaseContext.Provider value={{ db }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context.db;
}
