import { WorkSpaceContainer } from '@pages/work-space';
import { ShortcutProvider } from '@shared/lib/shortcuts';
import { ShortcutMenu } from '@shared/ui/shortcut-menu';
import './app.css';

export default function App() {
  return (
    <ShortcutProvider>
      <WorkSpaceContainer />
      <ShortcutMenu />
    </ShortcutProvider>
  );
}
