'use client';

import { useState } from 'react';
import { A11yWidget, type A11yLabels } from './A11yWidget';
import { ChatWidget } from './ChatWidget';
import { StickyCta } from './StickyCta';

/**
 * The three floating controls, outside #dpl-page so zoom and colour filters do not move or recolour them: the sticky
 * call button, the accessibility tools (bottom start) and the chat (bottom end). They share two bits of state: opening the
 * chat closes the accessibility panel, and the sticky button steps aside while the chat is open.
 */
export function FloatingWidgets({ a11y }: { a11y: A11yLabels }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);

  return (
    <>
      <StickyCta chatOpen={chatOpen} />
      <A11yWidget labels={a11y} open={a11yOpen} onToggle={() => setA11yOpen((o) => !o)} onClose={() => setA11yOpen(false)} />
      <ChatWidget
        open={chatOpen}
        onToggle={() => {
          setChatOpen((o) => !o);
          setA11yOpen(false);
        }}
        onClose={() => setChatOpen(false)}
      />
    </>
  );
}
