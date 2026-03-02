const fs = require('fs');
const file = 'src/components/dashboard/DailyPanel.tsx';
let lines = fs.readFileSync(file, 'utf-8').split('\n');

const newImports = `import { Dialog, DialogContent } from "@/components/ui/dialog";
import { themes } from "@/config/themes";
import { useDailyTodos } from "./hooks/useDailyTodos";
import { useDailyData } from "./hooks/useDailyData";
import { useDailyWidgetUI } from "./hooks/useDailyWidgetUI";`;

// We find the line containing "import { Dialog, DialogContent }"
const importIndex = lines.findIndex(l => l.includes('import { Dialog, DialogContent } from "@/components/ui/dialog";'));

lines.splice(importIndex, 2, newImports);

const newBody = `    const { theme, setTheme } = useTheme();
    const { activeProjectId, setActiveProjectId, clearUntitledTodos } = useTodoStore();
    const { settings, isWidgetMode, setWidgetMode, saveSettings, dailyLog } = useDataStore();

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    const [isWeeklyView, setIsWeeklyView] = useState(false);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
    const [timeTableViewMode, setTimeTableViewMode] = useState<'timetable' | 'app-usage'>('timetable');

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isCompactMode = !isWidgetMode && ((isSidebarOpen && windowWidth < 1200) || windowWidth < 1024);

    const {
        todos,
        isGeneralOpen,
        setIsGeneralOpen,
        uniqueGeneralTodos,
        uniqueGeneralCompletion
    } = useDailyTodos();

    const {
        isWidgetLocked,
        setIsWidgetLocked,
        isPinned,
        headerRef,
        editorContentRef,
        togglePin
    } = useDailyWidgetUI(settings, isWidgetMode, setWidgetMode, saveSettings, theme, setTheme, todos);

    const {
        sessions,
        screenshots,
        plannedSessions,
        manualQuote,
        firstOpenedAt,
        liveSession,
        displayDate,
        filteredSessions,
        filteredLiveSession
    } = useDailyData(projects, settings, now);`;

const startIndex = lines.findIndex(l => l.includes('const [isWidgetLocked, setIsWidgetLocked] = useState(false);'));
const endIndex = lines.findIndex(l => l.includes('const filteredLiveSession = useMemo(() => {'));
// The end block actually ends a few lines after `const filteredLiveSession = useMemo(() => {`
// Let's find the `return (` that starts the component rendering.
const returnIndex = lines.findIndex(l => l.trim() === 'return (');

// Delete from startIndex to returnIndex - 1
lines.splice(startIndex, returnIndex - startIndex, newBody, '');

fs.writeFileSync(file, lines.join('\n'));
console.log("Replacement completed successfully.");
