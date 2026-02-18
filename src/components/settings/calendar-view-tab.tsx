import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AppSettings } from "@/types";
import { useTranslation } from "react-i18next";

interface CalendarViewTabProps {
    settings: AppSettings;
    updateSettings: (updates: Partial<AppSettings>) => void;
}

export function CalendarViewTab({ settings, updateSettings }: CalendarViewTabProps) {
    // const { t } = useTranslation();

    const handleToggle = (key: keyof NonNullable<AppSettings['calendarSettings']>) => {
        const current = settings.calendarSettings || { showNonWorkApps: false, showNighttime: false };
        updateSettings({
            calendarSettings: {
                ...current,
                [key]: !current[key]
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-base">Non-Work Programs</Label>
                    <p className="text-sm text-muted-foreground">
                        Show programs not in your "Work Apps" list in the calendar.
                    </p>
                </div>
                <Switch
                    checked={settings.calendarSettings?.showNonWorkApps ?? false}
                    onCheckedChange={() => handleToggle('showNonWorkApps')}
                />
            </div>
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <Label className="text-base">Nighttime</Label>
                    <p className="text-sm text-muted-foreground">
                        Show sleep or nighttime blocks in the calendar.
                    </p>
                </div>
                <Switch
                    checked={settings.calendarSettings?.showNighttime ?? false}
                    onCheckedChange={() => handleToggle('showNighttime')}
                />
            </div>
            {/* Color pickers could go here if needed */}
        </div>
    );
}
