import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Search, X, Check, FolderOpen } from "lucide-react";
import { Project } from "@/types";
import { useDataStore } from "@/hooks/useDataStore";
import { cn } from "@/lib/utils";

interface AppSearchBarProps {
    focusedProject: Project | null;
    onFocusProject: (project: Project | null) => void;
    isMobile?: boolean;
    isOpen?: boolean;
    onClose?: () => void;
}

export function AppSearchBar({ focusedProject, onFocusProject, isMobile, isOpen, onClose }: AppSearchBarProps) {
    const { t } = useTranslation();
    const { projects, searchQuery, setSearchQuery, addToHistory } = useDataStore();

    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'date', direction: 'asc' | 'desc' }>({ key: 'date', direction: 'desc' });

    // Filter projects for suggestions
    const filteredProjects = projects.filter(p =>
        !searchQuery.trim() || p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
    );

    const sortedProjects = [...filteredProjects].sort((a, b) => {
        if (sortConfig.key === 'name') {
            return sortConfig.direction === 'asc'
                ? a.name.localeCompare(b.name)
                : b.name.localeCompare(a.name);
        } else {
            const dateA = new Date(a.startDate).getTime();
            const dateB = new Date(b.startDate).getTime();
            return sortConfig.direction === 'asc'
                ? dateA - dateB
                : dateB - dateA;
        }
    });

    if (isMobile) {
        if (!isOpen) return null;
        return (
            <div className="lg:hidden absolute left-0 top-0 right-0 h-10 bg-muted/95 backdrop-blur-sm border-b border-border flex items-center px-4 z-[60] animate-in slide-in-from-right duration-200" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input
                        autoFocus
                        className="w-full h-8 pl-9 pr-4 text-sm font-medium bg-background border border-border/50 rounded-full focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all placeholder:text-muted-foreground/50"
                        placeholder={t('sidebar.search')}
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            if (!e.target.value) onFocusProject(null);
                        }}
                        onBlur={() => {
                            if (!searchQuery.trim() && onClose) {
                                setTimeout(() => onClose(), 200);
                            }
                        }}
                    />
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 ml-2 text-muted-foreground hover:text-foreground"
                    onClick={() => {
                        if (onClose) onClose();
                        setSearchQuery('');
                        onFocusProject(null);
                    }}
                >
                    <X className="w-4 h-4" />
                </Button>
            </div>
        );
    }

    return (
        <div className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] no-drag z-50" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-blue-500 transition-colors" />
                <input
                    className="w-full h-9 pl-9 pr-9 text-sm font-medium bg-background/50 border border-border/50 rounded-full focus:bg-background focus:border-blue-500/30 focus:ring-2 focus:ring-blue-500/10 focus:outline-none transition-all placeholder:text-muted-foreground/50 shadow-sm hover:bg-background/80"
                    placeholder={t('sidebar.search')}
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!e.target.value) onFocusProject(null);
                        if (!isSearchFocused) setIsSearchFocused(true);
                    }}
                    onFocus={(e) => {
                        setIsSearchFocused(true);
                        e.target.select();
                    }}
                    onClick={() => setIsSearchFocused(true)}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                />

                {searchQuery && (
                    <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 hover:bg-muted/50 rounded-full transition-colors"
                        onClick={() => {
                            setSearchQuery('');
                            setIsSearchFocused(false);
                            onFocusProject(null);
                        }}
                        tabIndex={-1}
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}

                {/* Suggestions Dropdown */}
                {isSearchFocused && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-popover/95 backdrop-blur-md border border-border shadow-2xl rounded-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col max-h-[400px]">
                        {/* Sort Controls Header */}
                        <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between shrink-0">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                {searchQuery.trim() ? t('sidebar.results') : t('sidebar.allProjects')}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    className={`text-[10px] uppercase font-bold tracking-wider hover:text-foreground transition-colors ${sortConfig.key === 'name' ? 'text-primary' : 'text-muted-foreground'}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setSortConfig(prev => ({ key: 'name', direction: prev.key === 'name' && prev.direction === 'asc' ? 'desc' : 'asc' }))}
                                >
                                    {t('sidebar.name')} {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                                </button>
                                <div className="w-px h-3 bg-border" />
                                <button
                                    className={`text-[10px] uppercase font-bold tracking-wider hover:text-foreground transition-colors ${sortConfig.key === 'date' ? 'text-primary' : 'text-muted-foreground'}`}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setSortConfig(prev => ({ key: 'date', direction: prev.key === 'date' && prev.direction === 'desc' ? 'asc' : 'desc' }))}
                                >
                                    {t('sidebar.date')} {sortConfig.key === 'date' && (sortConfig.direction === 'desc' ? '↓' : '↑')}
                                </button>
                            </div>
                        </div>

                        {/* Project List */}
                        <div className="overflow-y-auto custom-scrollbar flex-1 py-1 relative">
                            {sortedProjects.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                                    {searchQuery.trim() ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <Search className="w-8 h-8 opacity-20" />
                                            <p>{t('sidebar.noProjectsFound')}</p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2">
                                            <FolderOpen className="w-8 h-8 opacity-20" />
                                            <p>{t('sidebar.noProjectsAvailable')}</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="px-1">
                                    {sortedProjects.map((p) => (
                                        <div
                                            key={p.id}
                                            className={cn(
                                                "w-full px-3 py-2.5 flex items-center gap-3 hover:bg-muted/50 rounded-lg cursor-pointer transition-all",
                                                focusedProject?.id === p.id && "bg-primary/10 text-primary hover:bg-primary/15"
                                            )}
                                            onMouseDown={(e) => e.preventDefault()}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const isDeselecting = p.id === focusedProject?.id;
                                                onFocusProject(isDeselecting ? null : p);
                                                setSearchQuery(isDeselecting ? '' : p.name);
                                                setIsSearchFocused(false);
                                                if (!isDeselecting) {
                                                    addToHistory();
                                                }
                                                if (document.activeElement instanceof HTMLElement) {
                                                    document.activeElement.blur();
                                                }
                                            }}
                                        >
                                            <div
                                                className="w-3 h-3 rounded-full shrink-0 shadow-sm border border-background/20"
                                                style={{ backgroundColor: p.color || '#3b82f6' }}
                                            />
                                            <div className="flex-1 min-w-0 text-left">
                                                <div className="text-sm font-medium truncate flex-1 block overflow-hidden text-ellipsis whitespace-nowrap">
                                                    {p.name}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 shrink-0 px-2 py-0.5 max-w-[120px]">
                                                {p.type && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded-full">
                                                        {p.type}
                                                    </span>
                                                )}
                                            </div>
                                            {focusedProject?.id === p.id && (
                                                <Check className="w-4 h-4 text-primary shrink-0" />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        {/* Bottom gradient fade out */}
                        <div className="h-6 bg-gradient-to-t from-popover to-transparent shrink-0 pointer-events-none -mt-6 z-10" />
                    </div>
                )}
            </div>
        </div>
    );
}
