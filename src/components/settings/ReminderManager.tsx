import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Bell, Edit2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ReminderManager() {
    const { t } = useTranslation();
    const { settings, saveSettings } = useDataStore();
    const [newReminder, setNewReminder] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    const reminders = settings?.reminders || [];

    const handleAddReminder = () => {
        if (!newReminder.trim() || !settings) return;
        const updatedReminders = [...reminders, newReminder.trim()];
        saveSettings({ ...settings, reminders: updatedReminders });
        setNewReminder('');
    };

    const handleDeleteReminder = (index: number) => {
        if (!settings) return;
        const updatedReminders = reminders.filter((_, i) => i !== index);
        saveSettings({ ...settings, reminders: updatedReminders });
    };

    const startEditing = (index: number, value: string) => {
        setEditingIndex(index);
        setEditValue(value);
    };

    const cancelEditing = () => {
        setEditingIndex(null);
        setEditValue('');
    };

    const saveEdit = () => {
        if (editingIndex === null || !settings) return;
        if (!editValue.trim()) {
            handleDeleteReminder(editingIndex);
            cancelEditing();
            return;
        }
        const updatedReminders = [...reminders];
        updatedReminders[editingIndex] = editValue.trim();
        saveSettings({ ...settings, reminders: updatedReminders });
        cancelEditing();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Input
                        placeholder={t('settings.appearance.reminders.placeholder') || "Enter a new reminder..."}
                        value={newReminder}
                        onChange={(e) => setNewReminder(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddReminder()}
                        className="pl-12 pr-4 h-11 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all rounded-xl shadow-sm"
                    />
                    <Bell className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                </div>
                <Button
                    onClick={handleAddReminder}
                    disabled={!newReminder.trim()}
                    className="h-11 px-6 rounded-xl shadow-sm transition-all hover:shadow-md font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" /> {t('settings.appearance.reminders.add') || "Add"}
                </Button>
            </div>

            <div className="bg-muted/10 rounded-2xl border border-border/50 shadow-inner overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-background/5 to-transparent pointer-events-none" />
                <ScrollArea className="h-[320px] w-full p-4 sm:p-5">
                    {reminders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 space-y-4 min-h-[200px] animate-in fade-in duration-500">
                            <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mb-2 ring-1 ring-border/50 shadow-sm">
                                <Bell className="w-6 h-6 opacity-50" />
                            </div>
                            <p className="text-sm font-medium">{t('settings.appearance.reminders.empty') || "No reminders added yet."}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {reminders.map((reminder, index) => (
                                <div
                                    key={index}
                                    className="relative flex items-start gap-4 p-4 pl-5 bg-background/60 hover:bg-background rounded-xl group transition-all duration-300 border border-border/30 hover:border-border/80 shadow-sm hover:shadow-md"
                                >
                                    <div className="mt-0.5 flex-shrink-0 text-primary/40 group-hover:text-primary transition-colors">
                                        <Bell className="w-4 h-4" />
                                    </div>

                                    {editingIndex === index ? (
                                        <div className="flex-1 flex items-center gap-2 pl-4">
                                            <Input
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') cancelEditing();
                                                }}
                                                autoFocus
                                                className="h-8 bg-background/50 border-primary/50 text-sm"
                                            />
                                            <div className="flex items-center -mr-2 -mt-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10 rounded-full"
                                                    onClick={saveEdit}
                                                >
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
                                                    onClick={cancelEditing}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm flex-1 whitespace-pre-wrap leading-relaxed text-foreground/90 pt-0.5 pl-2">
                                                {reminder}
                                            </p>
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 -mr-2 -mt-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                    onClick={() => startEditing(index, reminder)}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteReminder(index)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>

            <div className="flex items-center gap-2 px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                <p className="text-xs font-medium text-muted-foreground/70">
                    {t('settings.appearance.reminders.description') || "These reminders will appear randomly in the Reminder Modal."}
                </p>
            </div>
        </div>
    );
}
