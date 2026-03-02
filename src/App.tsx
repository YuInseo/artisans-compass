import { useEffect, useState } from 'react';



import { AppLayout } from '@/components/layout/AppLayout';
import { TimelineSection } from '@/components/dashboard/TimelineSection';
import { DailyPanel } from '@/components/dashboard/DailyPanel';
import { ClosingRitualModal } from '@/components/dashboard/ClosingRitualModal';
import { InspirationModal } from '@/components/dashboard/InspirationModal';
import { ReminderModal } from '@/components/dashboard/ReminderModal';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { DailyArchiveModal } from '@/components/dashboard/DailyArchiveModal';
import { ThemeProvider } from "@/components/theme-provider"
import { SettingsModal } from '@/components/settings-modal';
import { Project } from "@/types";
import { useDataStore } from "@/hooks/useDataStore";
import { useTodoStore } from "@/hooks/useTodoStore";
import { Toaster } from "@/components/ui/sonner";
import { TodoSidebar } from "./components/dashboard/TodoSidebar";
import { WeeklyView } from "./components/dashboard/WeeklyView";
import { StatisticsPanel } from "@/components/dashboard/StatisticsPanel";

import { ProjectList } from '@/components/dashboard/ProjectList';
import { PomodoroPanel } from '@/components/dashboard/PomodoroPanel';
import { usePomodoroStore } from '@/hooks/usePomodoroStore';
import { DebugOverlay } from '@/components/debug-overlay';
import { useNightTimeNotification } from '@/hooks/useNightTimeNotification';

import { useSmartDate } from '@/hooks/useSmartDate';
import { useAppKeyboardShortcuts } from '@/hooks/useAppKeyboardShortcuts';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useAppDevMode } from '@/hooks/useAppDevMode';
import { useClosingRitual } from '@/hooks/useClosingRitual';

function App() {
  const { settings, saveSettings, loading, projects, searchQuery } = useDataStore();
  const { loadTodos } = useTodoStore();

  // Custom Hooks (Refactored)
  useNightTimeNotification();
  useSmartDate();
  useAppKeyboardShortcuts();
  useAppTheme();
  useAppDevMode();

  const {
    isRitualOpen,
    setIsRitualOpen,
    lastSessionSessions,
    lastSessionPlannedSessions,
    lastSessionScreenshots,
    lastSessionFirstOpenedAt,
    currentStats,
    handleOpenRitual,
    handleSaveLog
  } = useClosingRitual();

  const [showInspiration, setShowInspiration] = useState(true);
  const [showReminder, setShowReminder] = useState(false);

  // Sidebar State (Lifted for Responsiveness)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Global Pomodoro Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      usePomodoroStore.getState().tick();
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Load Todos on Startup (Fix for Carry-over visibility)
  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  // Archive State
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archiveDate, setArchiveDate] = useState<Date>(new Date());

  const [viewMode, setViewMode] = useState<'timeline' | 'list'>('timeline');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'timeline' | 'tracking' | 'integrations'>('general');
  const [focusedProject, setFocusedProject] = useState<Project | null>(null);

  // Dashboard view toggle state
  const [dashboardView, setDashboardView] = useState<'weekly' | 'daily' | 'pomodoro' | 'statistics'>('daily');

  // Navigation Signal State
  const [navigationSignal, setNavigationSignal] = useState<{ date: Date, timestamp: number } | null>(null);

  const handleNavigate = (date: Date) => {
    setNavigationSignal({ date, timestamp: Date.now() });
  };

  const handleOpenSettings = (tab: 'general' | 'timeline' | 'tracking' | 'integrations' = 'general') => {
    setSettingsTab(tab);
    setIsSettingsOpen(true);
  };

  const rowCount = settings?.visibleProjectRows || 3;
  const timelineHeight = (rowCount * 50) + 33;

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
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      {settings && !settings.hasCompletedOnboarding && !loading && (
        <OnboardingWizard
          isOpen={true}
          onComplete={() => { }}
        />
      )}
      <InspirationModal
        isOpen={showInspiration && !!settings?.hasCompletedOnboarding && settings?.enableQuotes !== false}
        onClose={() => setShowInspiration(false)}
      />
      <ReminderModal
        isOpen={showReminder}
        onClose={() => setShowReminder(false)}
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
        dashboardView={dashboardView}
        onDashboardViewChange={setDashboardView}
        timeline={
          viewMode === 'timeline'
            ? <TimelineSection
              searchQuery={searchQuery}
              focusedProject={focusedProject}
              navigationSignal={navigationSignal}
              onOpenSettings={handleOpenSettings}
              showFocusGoals={!isSidebarOpen && viewMode === 'timeline'}
            />
            : <ProjectList searchQuery={searchQuery} />
        }
        planPanel={
          <WeeklyView
            currentDate={navigationSignal?.date || new Date()}
            onDateChange={handleNavigate}
          />
        }
        todoPanel={
          <TodoSidebar
            onSelect={handleDateSelect}
            navigationSignal={navigationSignal}
          />
        }
        dailyPanel={
          <DailyPanel
            onEndDay={handleOpenRitual}
            onShowReminder={() => setShowReminder(true)}
            projects={projects}
            isSidebarOpen={isSidebarOpen}
            onOpenSettings={(tab) => handleOpenSettings(tab as 'general' | 'timeline' | 'tracking' | 'integrations')}
          />
        }
        pomodoroPanel={<PomodoroPanel />}
        statisticsPanel={
          <StatisticsPanel
            focusedProject={focusedProject}
            navigationSignal={navigationSignal}
          />
        }
      />
      <ClosingRitualModal
        isOpen={isRitualOpen}
        onClose={() => setIsRitualOpen(false)}
        currentStats={currentStats}
        onSaveLog={handleSaveLog}
        projects={projects}
        sessions={lastSessionSessions}
        plannedSessions={lastSessionPlannedSessions}
        screenshots={lastSessionScreenshots}
        firstOpenedAt={lastSessionFirstOpenedAt}
      />
      <DailyArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => {
          setIsArchiveOpen(false);
          handleNavigate(new Date()); // Reset Calendar to Today
        }}
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
