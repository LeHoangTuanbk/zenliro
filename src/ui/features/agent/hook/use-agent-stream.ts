import { useEffect } from 'react';
import { useAgentStore } from '../store/agent-store';

export function useAgentStream() {
  useEffect(() => {
    const api = window.electron?.agent;
    if (!api) return;

    const store = useAgentStore.getState;

    const cleanups = [
      api.onStreamText((chunk) => {
        useAgentStore.setState({ isStreaming: true });
        store().appendStreamText(chunk);
      }),

      api.onStreamToolUse((data) => {
        useAgentStore.setState({ isStreaming: true });
        store().addToolCall({
          id: data.id,
          name: data.name,
          params: data.params,
          status: 'done',
        });
      }),

      api.onStreamThinking((text) => {
        store().setCurrentThinking(store().currentThinking + text);
      }),

      api.onStreamDone(() => {
        store().finalizeAssistantMessage();
        useAgentStore.setState({ isStreaming: false });
      }),

      api.onStreamError((error) => {
        store().appendStreamText(`\n\nError: ${error}`);
        store().finalizeAssistantMessage();
        useAgentStore.setState({ isStreaming: false });
      }),
    ];

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);
}
