import { useCallback } from 'react';
import { useAgentStore } from './store/agent-store';
import { useReferenceStore } from './store/reference-store';
import { useAgentStream } from './hook/use-agent-stream';
import { AgentPanelView } from './ui/agent-panel-view';

export function AgentPanelContainer() {
  useAgentStream();

  const isOpen = useAgentStore((s) => s.isOpen);
  const isMaximized = useAgentStore((s) => s.isMaximized);
  const isStreaming = useAgentStore((s) => s.isStreaming);
  const messages = useAgentStore((s) => s.messages);
  const currentItems = useAgentStore((s) => s.currentItems);
  const toggle = useAgentStore((s) => s.toggle);
  const setMaximized = useAgentStore((s) => s.setMaximized);
  const addUserMessage = useAgentStore((s) => s.addUserMessage);
  const clearMessages = useAgentStore((s) => s.clearMessages);

  const handleSend = useCallback(
    async (text: string) => {
      addUserMessage(text);
      // Show loading immediately while CLI spawns
      useAgentStore.setState({ isStreaming: true });
      const ref = useReferenceStore.getState();
      const { modelId } = useAgentStore.getState();
      let message = text;
      if (ref.referenceBase64) {
        message = `${text}\n\n[Reference image attached — match this style/mood]`;
      }
      await window.electron?.agent?.sendMessage(message, { model: modelId });
    },
    [addUserMessage],
  );

  const handleStop = useCallback(async () => {
    await window.electron?.agent?.stopSession();
    useAgentStore.getState().finalizeAssistantMessage();
    useAgentStore.setState({ isStreaming: false });
  }, []);

  const handleMaximize = useCallback(() => {
    setMaximized(!isMaximized);
  }, [isMaximized, setMaximized]);

  if (!isOpen) return null;

  return (
    <AgentPanelView
      isMaximized={isMaximized}
      isStreaming={isStreaming}
      messages={messages}
      currentItems={currentItems}
      onSend={handleSend}
      onStop={handleStop}
      onToggle={toggle}
      onMaximize={handleMaximize}
      onClear={clearMessages}
    />
  );
}
