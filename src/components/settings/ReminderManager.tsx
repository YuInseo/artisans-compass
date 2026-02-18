import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ReminderManager() {
    const { t } = useTranslation();
    const { settings, saveSettings } = useDataStore();
    const [newReminder, setNewReminder] = useState('');

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

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder={t('settings.appearance.reminders.placeholder') || "Enter a new reminder..."}
                    value={newReminder}
                    onChange={(e) => setNewReminder(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddReminder()}
                    className="flex-1"
                />
                <Button onClick={handleAddReminder} disabled={!newReminder.trim()}>
                    <Plus className="w-4 h-4 mr-2" /> {t('settings.appearance.reminders.add') || "Add"}
                </Button>
            </div>

            <div className="border rounded-md">
                <ScrollArea className="h-[300px] w-full p-4">
                    {reminders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2 min-h-[100px]">
                            <Bell className="w-8 h-8" />
                            <p>{t('settings.appearance.reminders.empty') || "No reminders added yet."}</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {reminders.map((reminder, index) => (
                                <div key={index} className="flex items-start justify-between p-3 bg-card/50 rounded-lg group hover:bg-card transition-colors border border-border/50">
                                    <p className="text-sm flex-1 mr-4 whitespace-pre-wrap">{reminder}</p>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteReminder(index)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </div>
            <p className="text-xs text-muted-foreground">
                {t('settings.appearance.reminders.description') || "These reminders will appear randomly in the Reminder Modal."}
            </p>
        </div>
    );
}
