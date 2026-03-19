import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AppSettings } from "@/types"
import { useState, useEffect } from "react"
import { useTranslation } from 'react-i18next';
import { IPluginManifest } from "@/plugins/api"
import { FolderOpen } from "lucide-react"

interface PluginsTabProps {
    settings: AppSettings;
    onSaveSettings: (settings: AppSettings) => Promise<void>;
}

export function PluginsTab({ settings, onSaveSettings }: PluginsTabProps) {
    const { t } = useTranslation();
    const [plugins, setPlugins] = useState<IPluginManifest[]>([]);
    const [pluginsDir, setPluginsDir] = useState<string>("");

    useEffect(() => {
        const fetchPlugins = async () => {
            if ((window as any).ipcRenderer) {
                const dir = await (window as any).ipcRenderer.invoke('get-plugins-dir');
                setPluginsDir(dir);

                const loadedPlugins = await (window as any).ipcRenderer.invoke('get-plugins');
                setPlugins(loadedPlugins);
            }
        };
        fetchPlugins();
    }, []);

    const handleTogglePlugin = (pluginId: string, enabled: boolean) => {
        const currentEnabled = settings.enabledPlugins || [];
        const newEnabled = enabled
            ? [...currentEnabled, pluginId]
            : currentEnabled.filter(id => id !== pluginId);

        onSaveSettings({
            ...settings,
            enabledPlugins: newEnabled
        });
    };

    const handleOpenFolder = () => {
        if ((window as any).ipcRenderer && pluginsDir) {
            (window as any).ipcRenderer.invoke('open-external', `file://${pluginsDir}`);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pb-1 mb-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-foreground">{t('settings.plugins') || "Plugins"}</h3>
                    <Button variant="outline" size="sm" onClick={handleOpenFolder} className="gap-2">
                        <FolderOpen className="w-4 h-4" />
                        Open Folder
                    </Button>
                </div>
                <Separator className="bg-border/60 mt-2" />
            </div>

            <div className="space-y-4 mb-8">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-4">Installed Plugins</h5>

                {plugins.length === 0 ? (
                    <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md text-center">
                        No plugins found in {pluginsDir}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {plugins.map((plugin) => {
                            const isEnabled = (settings.enabledPlugins || []).includes(plugin.id);
                            return (
                                <div key={plugin.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50 transition-colors">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Label className="text-base font-semibold">{plugin.name}</Label>
                                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-mono">v{plugin.version}</span>
                                        </div>
                                        <p className="text-sm text-muted-foreground">{plugin.description}</p>
                                        {plugin.author && (
                                            <p className="text-xs text-muted-foreground/70">By {plugin.author}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Switch
                                            checked={isEnabled}
                                            onCheckedChange={(checked) => handleTogglePlugin(plugin.id, checked)}
                                        />
                                        <span className={`text-[10px] font-bold uppercase ${isEnabled ? 'text-green-500' : 'text-muted-foreground'}`}>
                                            {isEnabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <p className="text-xs text-muted-foreground mt-4 opacity-80">
                    Note: Changing plugin states requires a restart to fully take effect.
                </p>
            </div>
        </div>
    );
}
