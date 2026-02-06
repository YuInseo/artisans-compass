

import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Sun, Moon, Monitor } from "lucide-react";
import { AppSettings } from "@/types"
import { cn } from "@/lib/utils"
import { useTranslation } from 'react-i18next';

interface AppearanceTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
    theme: string | undefined;
    setTheme: (theme: "light" | "dark" | "system") => void;
}

function ThemeCard({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
    return (
        <div
            onClick={onClick}
            className={cn(
                "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:scale-[1.02]",
                active
                    ? "border-primary bg-primary/5 shadow-md"
                    : "border-border/40 bg-card hover:border-primary/50 hover:bg-muted/30"
            )}
        >
            <div className={cn("transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                {icon}
            </div>
            <span className={cn("text-xs font-semibold", active ? "text-primary" : "text-muted-foreground")}>{label}</span>
        </div>
    )
}

export function AppearanceTab({ settings, onSaveSettings, theme, setTheme }: AppearanceTabProps) {
    const { t } = useTranslation();

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            <div>
                <h3 className="text-xl font-bold mb-4 text-foreground">{t('settings.appearance.title')}</h3>
                <Separator className="bg-border/60" />
            </div>

            <div className="flex flex-col bg-muted/30 rounded-lg border border-border/50 overflow-hidden" id="settings-theme">
                <div className="p-4 space-y-4">
                    <h5 className="text-base font-semibold text-foreground">{t('settings.theme')}</h5>
                    <div className="grid grid-cols-3 gap-4">
                        <ThemeCard
                            active={theme === 'light'}
                            onClick={() => setTheme('light')}
                            icon={<Sun className="w-6 h-6" />}
                            label={t('settings.light')}
                        />
                        <ThemeCard
                            active={theme === 'dark'}
                            onClick={() => setTheme('dark')}
                            icon={<Moon className="w-6 h-6" />}
                            label={t('settings.dark')}
                        />
                        <ThemeCard
                            active={theme === 'system'}
                            onClick={() => setTheme('system')}
                            icon={<Monitor className="w-6 h-6" />}
                            label={t('settings.system')}
                        />
                    </div>
                </div>

                {/* Color Theme Selector - Only Visible in Dark Mode */}
                {theme === 'dark' && (
                    <div className="border-t border-border/50 bg-muted/20 p-4 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex flex-col gap-3">
                            <h5 className="text-sm font-medium text-muted-foreground">{t('settings.appearance.colorTheme') || "Color Theme"}</h5>
                            <div className="flex items-center gap-4">
                                <Select
                                    value={settings.themePreset || 'default'}
                                    onValueChange={(val: any) => {
                                        const savedTheme = settings.customThemes?.find(t => t.id === val);
                                        if (savedTheme) {
                                            onSaveSettings({
                                                ...settings,
                                                themePreset: val,
                                                customCSS: savedTheme.css
                                            });
                                        } else {
                                            onSaveSettings({ ...settings, themePreset: val });
                                        }
                                    }}
                                >
                                    <SelectTrigger className="w-[200px] bg-background border-input">
                                        <SelectValue placeholder="Select Theme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="default">Default (Slate)</SelectItem>
                                        <SelectItem value="discord">Discord (Gamer)</SelectItem>
                                        <SelectItem value="midnight">Midnight (OLED)</SelectItem>
                                        <SelectItem value="sunset">Sunset (Warm)</SelectItem>
                                        <SelectItem value="ocean">Ocean (Blue)</SelectItem>
                                        <SelectItem value="forest">Forest (Green)</SelectItem>

                                        {settings.customThemes && settings.customThemes.length > 0 && (
                                            <>
                                                <Separator className="my-1 opacity-50" />
                                                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t('settings.appearance.myThemes')}</div>
                                                {settings.customThemes.map(theme => (
                                                    <SelectItem key={theme.id} value={theme.id}>
                                                        {theme.name}
                                                    </SelectItem>
                                                ))}
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                                <div className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-foreground">
                                        {settings.themePreset === 'discord' ? "Gamer Style" :
                                            settings.themePreset === 'midnight' ? "Pure Black" :
                                                settings.themePreset === 'sunset' ? "Warm & Cozy" :
                                                    settings.themePreset === 'ocean' ? "Deep Blue" :
                                                        settings.themePreset === 'forest' ? "Nature" :
                                                            settings.customThemes?.some(t => t.id === settings.themePreset) ?
                                                                (settings.customThemes?.find(t => t.id === settings.themePreset)?.name || "User Theme") :
                                                                "Standard"}
                                    </span>
                                    <span className="text-xs text-muted-foreground opacity-70">
                                        {t('settings.appearance.colorTheme')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex flex-col bg-muted/30 rounded-lg border border-border/50 overflow-hidden" id="settings-widgets">
                <div className="flex items-center justify-between p-4 bg-muted/20">
                    <div className="space-y-0.5">
                        <Label className="text-base font-semibold">{t('settings.appearance.widgetHeader')}</Label>
                        <p className="text-xs text-muted-foreground opacity-80">{t('settings.appearance.widgetHeaderDesc')}</p>
                    </div>
                    <Select
                        value={settings.widgetDisplayMode || 'none'}
                        onValueChange={(val: any) => onSaveSettings({ ...settings, widgetDisplayMode: val })}
                    >
                        <SelectTrigger className="w-[180px] bg-background border-input">
                            <SelectValue placeholder={t('settings.appearance.selectDisplay')} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">{t('settings.appearance.none')}</SelectItem>
                            <SelectItem value="quote">{t('settings.appearance.dailyQuote')}</SelectItem>
                            <SelectItem value="goals">{t('settings.appearance.focusGoals')}</SelectItem>
                            <SelectItem value="timer">{t('dashboard.timer') || 'Focus Timer'}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {settings.widgetDisplayMode && settings.widgetDisplayMode !== 'none' && (
                    <div className="flex flex-col gap-4 p-4 border-t border-border/50 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t('settings.appearance.widgetMaxHeight')}</Label>
                            <span className="text-xs text-muted-foreground">{settings.widgetMaxHeight || 800}px</span>
                        </div>
                        <div>
                            <Slider
                                min={300}
                                max={1200}
                                step={50}
                                value={[settings.widgetMaxHeight || 800]}
                                onValueChange={(val) => onSaveSettings({ ...settings, widgetMaxHeight: val[0] })}
                            />
                            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-1">
                                <span>{t('settings.appearance.short')}</span>
                                <span>{t('settings.appearance.tall')}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Separator className="bg-border/30" />

            <div className="space-y-4" id="settings-editor">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base font-medium">{t('settings.appearance.indentationLines')}</Label>
                            <p className="text-sm text-muted-foreground">{t('settings.appearance.indentationLinesDesc')}</p>
                        </div>
                        <Switch
                            checked={settings.showIndentationGuides !== false}
                            onCheckedChange={(checked) => onSaveSettings({ ...settings, showIndentationGuides: checked })}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label className="text-base font-medium">{t('settings.appearance.spellCheck')}</Label>
                            <p className="text-sm text-muted-foreground">{t('settings.appearance.spellCheckDesc')}</p>
                        </div>
                        <Switch
                            checked={settings.enableSpellCheck !== false}
                            onCheckedChange={(checked) => onSaveSettings({ ...settings, enableSpellCheck: checked })}
                        />
                    </div>
                </div>
            </div>
            <Separator className="bg-border/30" />
        </div>
    )
}
