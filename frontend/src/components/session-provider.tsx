"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

type SessionContextValue = {
  sessionId: string | null;
  hasSessionCv: boolean;
  setSessionCv: (sessionId: string) => void;
  clearSessionCv: () => void;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);

  const setSessionCv = useCallback((id: string) => {
    setSessionId(id);
  }, []);

  const clearSessionCv = useCallback(() => {
    setSessionId(null);
  }, []);

  const value = useMemo(
    () => ({
      sessionId,
      hasSessionCv: Boolean(sessionId),
      setSessionCv,
      clearSessionCv,
    }),
    [sessionId, setSessionCv, clearSessionCv],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return value;
}
