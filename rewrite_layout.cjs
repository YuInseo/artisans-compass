const fs = require('fs');
let content = fs.readFileSync('src/components/layout/AppLayout.tsx', 'utf-8');

try {
    // 1. Extract the Sidebar Rail
    const sidebarStartStr = '{/* 1. App Sidebar Rail (Activity Bar) - Not shown in widget mode */}';
    const sidebarEndStr = ')}';
    const sidebarStartIndex = content.indexOf(sidebarStartStr);
    // Find the closing parenthese
    let openCount = 0;
    let sidebarEndIndex = -1;
    // Starting from sidebarStartIndex, find the matching )}
    for (let i = sidebarStartIndex; i < content.length; i++) {
        if (content[i] === '(') openCount++;
        if (content[i] === ')') {
            openCount--;
            if (openCount === 0 && content.substring(i, i + 2) === ')}') {
                sidebarEndIndex = i + 2;
                break;
            }
        }
    }
    if (sidebarEndIndex === -1) {
        console.error("Could not find end of sidebar");
        process.exit(1);
    }

    // 2. Remove mt-10
    content = content.replace('<div className="flex-1 flex mt-10 min-h-0 overflow-hidden relative">', '<div className="flex-1 flex min-h-0 overflow-hidden relative">');

    // 3. Extract the UpdateChecker, Notification Button, and Settings Button
    const viewToggleStart = content.indexOf('{/* View Toggle Buttons & Settings */}');
    const btnSettingsEndIndex = content.indexOf('</Button>', content.indexOf('{/* Settings Button */}')) + 9;
    const extractedButtons = content.substring(content.indexOf('{/* Update Checker */}'), btnSettingsEndIndex);

    // Find the end of the container div
    let viewToggleEnd = content.indexOf('</div>', btnSettingsEndIndex) + 6;

    content = content.substring(0, viewToggleStart) + content.substring(viewToggleEnd);

    // 4. Construct new sidebar component
    const newSidebar = `
            {/* 1. App Sidebar Rail (Activity Bar) - Full Height */}
            {!isWidgetMode && (
                <div className="w-14 h-full shrink-0 flex flex-col items-center py-4 gap-4 border-r border-border/50 bg-muted/10 z-[60] overflow-visible relative window-drag">
                    <div className="no-drag w-full flex flex-col items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("rounded-xl transition-all", dashboardView === 'daily' && isSidebarOpen ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground hover:bg-muted")}
                            onClick={() => {
                                if (dashboardView === 'daily') setIsSidebarOpen(!isSidebarOpen);
                                else { onDashboardViewChange('daily'); setIsSidebarOpen(true); }
                            }}
                            title={t('sidebar.daily', "Action")}
                        >
                            <LayoutDashboard className="w-5 h-5" />
                            {todoBadgeCount > 0 && dashboardView !== 'daily' && (
                                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground transform scale-90">
                                    {todoBadgeCount}
                                </span>
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn("rounded-xl transition-all relative", dashboardView === 'weekly' && isSidebarOpen ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground hover:bg-muted")}
                            onClick={() => {
                                if (dashboardView === 'weekly') setIsSidebarOpen(!isSidebarOpen);
                                else { onDashboardViewChange('weekly'); setIsSidebarOpen(true); }
                            }}
                            title={t('sidebar.weekly', "Plan")}
                        >
                            <CalendarDays className="w-5 h-5" />
                        </Button>
                    </div>

                    <div className="mt-auto flex flex-col items-center gap-2 no-drag w-full">
${extractedButtons.split('\\n').map(l => '                        ' + l.trimLeft()).join('\\n')}
                    </div>
                </div>
            )}
`;

    // Also we need to make sure we remove the original sidebar rail!
    const originalSidebarRailRegex = /\{\/\* 1\. App Sidebar Rail[\s\S]*?CalendarDays className="w-5 h-5" \/>\s*<\/Button>\s*<\/div>\s*\)\}/m;
    content = content.replace(originalSidebarRailRegex, '');

    // 5. Transform the outer container
    const outerDivStr = '<div className={cn("flex flex-col h-screen w-screen bg-background relative overflow-hidden text-foreground", "font-sans", fontClass)}>';
    content = content.replace(outerDivStr, '<div className={cn("flex flex-row h-screen w-screen bg-background relative overflow-hidden text-foreground", "font-sans", fontClass)}>\n' + newSidebar + '\n            {/* Main Content Area (Column) */}\n            <div className="flex-1 flex flex-col min-w-0 h-full relative">\n');

    // 6. Close the new flex-col column
    // It should be exactly before the final </div> of the return block
    // The final </div> is before );
    const returnBlockMatch = content.match(/<\/div>\s*\)\;/);
    if (returnBlockMatch) {
        content = content.substring(0, returnBlockMatch.index) + '\n            </div>\n' + content.substring(returnBlockMatch.index);
    }

    // 7. Fix Title bar "fixed top-0 left-0 right-0" to "relative"
    content = content.replace(' z-50 window-drag fixed top-0 left-0 right-0 custom-scrollbar', ' z-40 window-drag relative custom-scrollbar');

    fs.writeFileSync('src/components/layout/AppLayout.tsx', content);
    console.log('Done rewriting AppLayout.tsx');

} catch (e) {
    console.error(e);
    process.exit(1);
}
