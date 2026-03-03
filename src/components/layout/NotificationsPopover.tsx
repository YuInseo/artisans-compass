import { useTranslation } from 'react-i18next';
import { Button } from "@/components/ui/button";
import { Bell, Check, Trash2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotificationStore } from "@/hooks/useNotificationStore";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export function NotificationsPopover() {
    const { t } = useTranslation();
    const notifications = useNotificationStore(state => state.notifications);
    const unreadCount = useNotificationStore(state => state.unreadCount);
    const markAsRead = useNotificationStore(state => state.markAsRead);
    const removeNotification = useNotificationStore(state => state.removeNotification);

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-10 h-10 shrink-0 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl relative"
                >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-background" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" side="right" className="w-[340px] p-0 overflow-hidden shadow-2xl bg-card/95 backdrop-blur-md border border-border/50 ml-2">
                <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Bell className="w-3.5 h-3.5" />
                        {t('notifications.title')}
                    </h4>
                    <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary" title={t('notifications.markAllRead')} onClick={() => useNotificationStore.getState().markAllAsRead()}>
                            <Check className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" title={t('notifications.clearAll')} onClick={() => useNotificationStore.getState().clearAll()}>
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
                <ScrollArea className="h-[300px]">
                    {notifications.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground space-y-2">
                            <Bell className="w-8 h-8 opacity-20" />
                            <p className="text-xs">{t('notifications.empty')}</p>
                        </div>
                    ) : (
                        <div className="flex flex-col p-1">
                            {notifications.map((n: any) => (
                                <div key={n.id} className={cn("relative group flex gap-3 p-3 rounded-lg transition-colors border-b border-border/30 last:border-0 hover:bg-muted/50", !n.read ? "bg-primary/5" : "bg-transparent")} onMouseEnter={() => !n.read && markAsRead(n.id)}>
                                    <div className="mt-1 shrink-0">
                                        {n.type === 'success' && <Check className="w-3.5 h-3.5 text-green-500" />}
                                        {n.type === 'error' && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                                        {n.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" />}
                                        {n.type === 'info' && <Info className="w-3.5 h-3.5 text-blue-500" />}
                                        {n.type === 'default' && <Bell className="w-3.5 h-3.5 text-muted-foreground" />}
                                    </div>
                                    <div className="flex-1 space-y-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <p className={cn("text-xs font-semibold leading-none", !n.read ? "text-foreground" : "text-muted-foreground")}>{n.title}</p>
                                                {n.count && n.count > 1 && <span className="text-[10px] bg-muted-foreground/20 text-muted-foreground px-1.5 py-0.5 rounded-full font-medium">x{n.count}</span>}
                                            </div>
                                            <span className="text-[10px] text-muted-foreground/60 whitespace-nowrap">{format(n.timestamp, 'HH:mm')}</span>
                                        </div>
                                        {n.description && <p className="text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed">{n.description}</p>}
                                    </div>
                                    <button className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-1 rounded-md" onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}>
                                        <X className="w-3 h-3" />
                                    </button>
                                    {!n.read && <div className="absolute top-3 right-3 w-1.5 h-1.5 bg-primary rounded-full group-hover:opacity-0 transition-opacity" />}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </PopoverContent>
        </Popover>
    );
}
