import { useEffect, useState } from 'react';



import { AppLayout } from '@/components/layout/AppLayout';
import { TimelineSection } from '@/components/dashboard/TimelineSection';
import { CalendarNav } from '@/components/dashboard/CalendarNav';
import { DailyPanel } from '@/components/dashboard/DailyPanel';
import { ClosingRitualModal } from '@/components/dashboard/ClosingRitualModal';
import { InspirationModal } from '@/components/dashboard/InspirationModal';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { DailyArchiveModal } from '@/components/dashboard/DailyArchiveModal';
import { format, addDays } from 'date-fns';
import { ThemeProvider } from "@/components/theme-provider"
import { SettingsModal } from '@/components/settings-modal';
import { Todo, Project } from "@/types";
import { useDataStore } from "@/hooks/useDataStore";
import { useTodoStore } from "@/hooks/useTodoStore";
import { Toaster } from "@/components/ui/sonner";

import { ProjectList } from '@/components/dashboard/ProjectList';
import { toast } from 'sonner';
import { DebugOverlay } from '@/components/debug-overlay';
import { useDebugStore } from '@/hooks/useDebugStore'; // Import for manual usage if needed

function App() {
  // Prevent Refresh (Ctrl+R, F5) logic moved to main listener below
  const { settings, saveSettings, loading, projects, searchQuery, undo: dataUndo, redo: dataRedo, lastActionTime: dataTime } = useDataStore();
  const { undo: todoUndo, redo: todoRedo, lastActionTime: todoTime, loadTodos } = useTodoStore();

  // Load Todos on Startup (Fix for Carry-over visibility)
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);



  const [isRitualOpen, setIsRitualOpen] = useState(false);
  const [showInspiration, setShowInspiration] = useState(true);
  const [currentStats, setCurrentStats] = useState({ totalSeconds: 0, questAchieved: false, screenshotCount: 0 });

  // Sidebar State (Lifted for Responsiveness)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Undo/Redo Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ' && !e.shiftKey) {
        e.preventDefault();
        // Global Undo Coordination
        if (todoTime > dataTime) {
          toast.info("Undo: Task Action");
          todoUndo();
        } else {
          toast.info("Undo: Project Action");
          dataUndo();
        }
      }
      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && ((e.code === 'KeyZ' && e.shiftKey) || e.code === 'KeyY')) {
        e.preventDefault();
        // Global Redo Coordination
        if (todoTime > dataTime) {
          toast.info("Redo: Task Action");
          todoRedo();
        } else {
          toast.info("Redo: Project Action");
          dataRedo();
        }
      }

      // Prevent Refresh (Ctrl+R, F5)
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyR') {
        e.preventDefault();
      }
      if (e.code === 'F5') {
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dataUndo, dataRedo, todoUndo, todoRedo, dataTime, todoTime]);

  // Developer Mode (F12)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'F12') {
        if (settings?.developerMode) {
          e.preventDefault();
          console.log("[App] F12 Pressed, toggling DevTools");
          if ((window as any).ipcRenderer) {
            (window as any).ipcRenderer.send('toggle-dev-tools');
          }
        } else {
          console.log("[App] F12 Pressed, but Developer Mode is OFF");
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings?.developerMode]);



  // Apply Theme Preset
  useEffect(() => {
    const root = document.documentElement;
    // Remove all theme preset classes
    root.classList.remove('theme-discord', 'theme-midnight', 'theme-sunset', 'theme-ocean', 'theme-forest', 'theme-custom');

    // Add current preset if set and not default
    if (settings?.themePreset && settings.themePreset !== 'default') {
      root.classList.add(`theme-${settings.themePreset}`);
    }
  }, [settings?.themePreset]);

  // Apply Custom CSS
  useEffect(() => {
    const styleId = 'custom-user-css';
    let styleTag = document.getElementById(styleId);

    if (settings?.themePreset === 'custom' && settings?.customCSS) {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = settings.customCSS;
    } else {
      if (styleTag) {
        styleTag.remove();
      }
    }
  }, [settings?.customCSS, settings?.themePreset]);

  useEffect(() => {
    if (!settings?.developerMode) return;

    const originalConsoleLog = console.log;
    const originalConsoleInfo = console.info;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    const addLog = useDebugStore.getState().addLog;

    const proxyLog = (level: 'info' | 'warn' | 'error' | 'debug', originalMethod: any, ...args: any[]) => {
      // Call original first
      originalMethod.apply(console, args);
      // Then add to store (non-blocking)
      try {
        addLog(level, args[0], 'frontend', ...args.slice(1));
      } catch (e) {
        // Prevent infinite loops if logging fails
      }
    };

    console.log = (...args) => proxyLog('debug', originalConsoleLog, ...args);
    console.info = (...args) => proxyLog('info', originalConsoleInfo, ...args);
    console.warn = (...args) => proxyLog('warn', originalConsoleWarn, ...args);
    console.error = (...args) => proxyLog('error', originalConsoleError, ...args);

    console.log("[Debug] Console interceptor active");

    return () => {
      console.log = originalConsoleLog;
      console.info = originalConsoleInfo;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    };
  }, [settings?.developerMode]);

  // Global Event & IPC Listener
  useEffect(() => {
    if (!settings?.developerMode) return;
    const addLog = useDebugStore.getState().addLog;

    // 1. Click Listener
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickable = target.closest('button, a, [role="button"], input, select');
      if (clickable) {
        let label = (clickable as HTMLElement).innerText || (clickable as any).name || (clickable as any).id || clickable.className;
        if (label.length > 50) label = label.substring(0, 50) + '...';
        addLog('info', `Click: ${clickable.tagName} "${label}"`, 'frontend');
      }
    };
    window.addEventListener('click', handleClick, true); // Capture phase

    // 2. Backend Log Listener
    let removeBackendListener: (() => void) | undefined;
    if ((window as any).ipcRenderer?.onBackendLog) {
      removeBackendListener = (window as any).ipcRenderer.onBackendLog((log: any) => {
        addLog(log.level, log.message, 'backend');
      });
    }

    return () => {
      window.removeEventListener('click', handleClick, true);
      if (removeBackendListener) removeBackendListener();
    };
  }, [settings?.developerMode]);



  // Archive State
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveDate, setArchiveDate] = useState<Date>(new Date());
  const [lastSessionTodos, setLastSessionTodos] = useState<Todo[]>([]);
  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'timeline' | 'tracking' | 'integrations'>('general'); // State for initial tab
  const [focusedProject, setFocusedProject] = useState<Project | null>(null);

  // Navigation Signal State
  const [navigationSignal, setNavigationSignal] = useState<{ date: Date, timestamp: number } | null>(null);

  const handleNavigate = (date: Date) => {
    setNavigationSignal({ date, timestamp: Date.now() });
  };

  const handleOpenSettings = (tab: 'general' | 'timeline' | 'tracking' | 'integrations' = 'general') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  // Calculate dynamic timeline height: (Rows * RowHeight) + HeaderHeight (+ buffer)
  // RowHeight = 50 (40 bar + 10 gap), Header = 32. 
  const rowCount = settings?.visibleProjectRows || 3;
  const timelineHeight = (rowCount * 50) + 33; // +33 for header border

  // Poll for stats when opening modal (or just keep them in sync via IPC)
  const handleOpenRitual = async (todos: Todo[] = []) => {
    // ... existing ...
    setLastSessionTodos(todos);
    // Fetch today's stats from IPC or store
    if ((window as any).ipcRenderer) {
      const now = new Date();
      const yearMonth = format(now, 'yyyy-MM');
      const dateStr = format(now, 'yyyy-MM-dd');
      const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
      const todayLog = logs[dateStr];

      if (todayLog) {
        // Calculate total seconds from sessions
        const totalSeconds = todayLog.sessions ? todayLog.sessions.reduce((acc: number, s: any) => acc + s.duration, 0) : 0;
        setCurrentStats({
          totalSeconds,
          questAchieved: todayLog.quest_cleared || false,
          screenshotCount: todayLog.screenshots?.length || 0
        });
      }
    }
    setIsRitualOpen(true);
  };

  const handleSaveLog = async (plan: string) => {
    // ... existing ...
    const now = new Date();
    const tomorrow = addDays(now, 1);
    const yearMonth = format(now, 'yyyy-MM');
    // Handle month boundary for tomorrow's log? 
    const tmrYearMonth = format(tomorrow, 'yyyy-MM');
    const dateStr = format(now, 'yyyy-MM-dd');
    const tmrDateStr = format(tomorrow, 'yyyy-MM-dd');

    // Parse Plan into Todos
    const newTodos: Todo[] = plan
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map((text, i) => ({
        id: `${Date.now()}-${i}`,
        text: text.replace(/^- [ ] /, '').replace(/^- /, ''), // Remove markdown checkbox/bullet if present
        completed: false
      }));

    if ((window as any).ipcRenderer) {
      // 1. Save Today's Log (Closing Note, Quest Cleared)
      const logs = await (window as any).ipcRenderer.getMonthlyLog(yearMonth);
      if (!logs[dateStr]) logs[dateStr] = {};

      console.log("[App] Saving Log - Plan:", plan);
      console.log("[App] Saving Log - Logs Obj:", logs[dateStr]);

      logs[dateStr].closingNote = plan;
      logs[dateStr].todos = lastSessionTodos;
      logs[dateStr].quest_cleared = true;
      if (settings?.nightTimeStart !== undefined) {
        logs[dateStr].nightTimeStart = settings.nightTimeStart;
      }

      await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });

      // 1.5 Sync to Notion (Manual Trigger)
      if (settings?.notionTokens?.accessToken && settings?.notionTokens?.databaseId) {
        const syncData = {
          ...logs[dateStr],
          closingNote: plan,
          quest_cleared: true
        };
        // Log to Main Process for visibility
        (window as any).ipcRenderer.send('log-message', `[App] Triggering Sync. Plan len: ${plan?.length}`);

        console.log("[App] Triggering Sync. Plan length:", plan?.length);
        console.log("[App] Sync Payload Keys:", Object.keys(syncData));
        console.log("[App] Payload.closingNote:", syncData.closingNote);

        (window as any).ipcRenderer.invoke('manual-sync-notion', {
          token: settings.notionTokens.accessToken,
          databaseId: settings.notionTokens.databaseId,
          dateStr,
          data: syncData
        }).catch((e: any) => {
          console.error("Notion sync trigger failed", e);
          (window as any).ipcRenderer.send('log-message', `[App] Sync Failed: ${e.message}`);
        });
      } else {
        (window as any).ipcRenderer.send('log-message', `[App] Sync Skipped: Missing Token/DB. Token: ${!!settings?.notionTokens?.accessToken}, DB: ${!!settings?.notionTokens?.databaseId}`);
      }

      // 2. Save Tomorrow's Todos (Handle Month Boundary)
      if (yearMonth === tmrYearMonth) {
        if (!logs[tmrDateStr]) logs[tmrDateStr] = {};
        const existingTodos = logs[tmrDateStr].todos || [];
        logs[tmrDateStr].todos = [...existingTodos, ...newTodos];
        await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth, data: logs });
      } else {
        // Different month
        const tmrLogs = await (window as any).ipcRenderer.getMonthlyLog(tmrYearMonth);
        if (!tmrLogs[tmrDateStr]) tmrLogs[tmrDateStr] = {};
        const existingTodos = tmrLogs[tmrDateStr].todos || [];
        tmrLogs[tmrDateStr].todos = [...existingTodos, ...newTodos];
        await (window as any).ipcRenderer.saveMonthlyLog({ yearMonth: tmrYearMonth, data: tmrLogs });
      }

      console.log("Day ended. Plan saved & parsed to tomorrow:", newTodos);
    }
    setIsRitualOpen(false);
  };

  const handleDateSelect = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);

    if (selected.getTime() < today.getTime()) {
      setArchiveDate(date);
      setIsArchiveOpen(true);
    }
  };

  if (loading) return null;

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      {settings && !settings.hasCompletedOnboarding && !loading && (
        <OnboardingWizard
          isOpen={true}
          onComplete={() => { }}
        />
      )}
      <InspirationModal
        isOpen={showInspiration && !!settings?.hasCompletedOnboarding}
        onClose={() => setShowInspiration(false)}
      />
      <AppLayout
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onOpenSettings={() => handleOpenSettings('general')}
        timelineHeight={timelineHeight}
        focusedProject={focusedProject}
        onFocusProject={setFocusedProject}
        timeline={
          viewMode === 'timeline'
            ? <TimelineSection
              searchQuery={searchQuery}
              focusedProject={focusedProject}
              navigationSignal={navigationSignal}
              onOpenSettings={handleOpenSettings}
            />
            : <ProjectList searchQuery={searchQuery} />
        }
        calendar={<CalendarNav onSelect={handleDateSelect} focusedProject={focusedProject} onNavigate={handleNavigate} navigationSignal={navigationSignal} />}
        dailyPanel={<DailyPanel onEndDay={handleOpenRitual} projects={projects} isSidebarOpen={isSidebarOpen} />}
      />
      <ClosingRitualModal
        isOpen={isRitualOpen}
        onClose={() => setIsRitualOpen(false)}
        currentStats={currentStats}
        onSaveLog={handleSaveLog}
        projects={projects}
        sessions={currentStats.totalSeconds ? [{ duration: currentStats.totalSeconds, process: "Focus Session", timestamp: Date.now() }] : []}
      />
      <DailyArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        date={archiveDate}
        onDateChange={setArchiveDate}
      />
      <SettingsModal
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        settings={settings}
        onSaveSettings={saveSettings}
        defaultTab={settingsTab}
      />
      <Toaster />
      <DebugOverlay />
    </ThemeProvider>
  );
}

export default App;
