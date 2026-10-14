'use client';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * UI state shared by the landing sections: the floating chat and the "Speak with an AI Advisor" modal can be opened
 * from the header, the hero, the CTA bands and the chat launcher.
 */
interface LandingUi {
  chatOpen: boolean;
  advisorOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  openAdvisor: () => void;
  closeAdvisor: () => void;
}

const Ctx = createContext<LandingUi | null>(null);

export function LandingUiProvider({ children }: { children: ReactNode }) {
  const [chatOpen, setChat] = useState(false);
  const [advisorOpen, setAdvisor] = useState(false);
  const openChat = useCallback(() => {
    setAdvisor(false);
    setChat(true);
  }, []);
  const openAdvisor = useCallback(() => {
    setChat(false);
    setAdvisor(true);
  }, []);
  const value = useMemo<LandingUi>(
    () => ({
      chatOpen,
      advisorOpen,
      openChat,
      closeChat: () => setChat(false),
      openAdvisor,
      closeAdvisor: () => setAdvisor(false),
    }),
    [chatOpen, advisorOpen, openChat, openAdvisor],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLandingUi(): LandingUi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLandingUi must be used inside <LandingUiProvider>');
  return v;
}
