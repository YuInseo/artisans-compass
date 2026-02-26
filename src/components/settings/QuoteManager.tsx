import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Quote, Edit2, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function QuoteManager() {
    const { t } = useTranslation();
    const { settings, saveSettings } = useDataStore();
    const [newQuote, setNewQuote] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editValue, setEditValue] = useState('');

    const quotes = settings?.customQuotes || [];

    const handleAddQuote = () => {
        if (!newQuote.trim() || !settings) return;
        const updatedQuotes = [...quotes, newQuote.trim()];
        saveSettings({ ...settings, customQuotes: updatedQuotes });
        setNewQuote('');
    };

    const handleDeleteQuote = (index: number) => {
        if (!settings) return;
        const updatedQuotes = quotes.filter((_, i) => i !== index);
        saveSettings({ ...settings, customQuotes: updatedQuotes });
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
            handleDeleteQuote(editingIndex);
            cancelEditing();
            return;
        }
        const updatedQuotes = [...quotes];
        updatedQuotes[editingIndex] = editValue.trim();
        saveSettings({ ...settings, customQuotes: updatedQuotes });
        cancelEditing();
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Input
                        placeholder={t('settings.appearance.customQuotes.placeholder') || "Enter a new quote..."}
                        value={newQuote}
                        onChange={(e) => setNewQuote(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddQuote()}
                        className="pl-12 pr-4 h-11 bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/50 transition-all rounded-xl shadow-sm"
                    />
                    <Quote className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                </div>
                <Button
                    onClick={handleAddQuote}
                    disabled={!newQuote.trim()}
                    className="h-11 px-6 rounded-xl shadow-sm transition-all hover:shadow-md font-medium"
                >
                    <Plus className="w-4 h-4 mr-2" /> {t('settings.appearance.customQuotes.add') || "Add"}
                </Button>
            </div>

            <div className="bg-muted/10 rounded-2xl border border-border/50 shadow-inner overflow-hidden relative">
                <div className="absolute inset-0 bg-gradient-to-b from-background/5 to-transparent pointer-events-none" />
                <ScrollArea className="h-[320px] w-full p-4 sm:p-5">
                    {quotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground/60 space-y-4 min-h-[200px] animate-in fade-in duration-500">
                            <div className="w-14 h-14 rounded-full bg-muted/30 flex items-center justify-center mb-2 ring-1 ring-border/50 shadow-sm">
                                <Quote className="w-6 h-6 opacity-50" />
                            </div>
                            <p className="text-sm font-medium">{t('settings.appearance.customQuotes.empty') || "No custom quotes added yet."}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {quotes.map((quote, index) => (
                                <div
                                    key={index}
                                    className="relative flex items-start gap-4 p-4 pl-5 bg-background/60 hover:bg-background rounded-xl group transition-all duration-300 border border-border/30 hover:border-border/80 shadow-sm hover:shadow-md"
                                >
                                    <div className="mt-0.5 flex-shrink-0 text-primary/40 group-hover:text-primary transition-colors">
                                        <Quote className="w-4 h-4" />
                                    </div>

                                    {editingIndex === index ? (
                                        <div className="flex-1 flex items-center gap-2 pl-2">
                                            <Input
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') saveEdit();
                                                    if (e.key === 'Escape') cancelEditing();
                                                }}
                                                autoFocus
                                                className="h-8 bg-background/50 border-primary/50 text-sm font-serif"
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
                                            <p className="text-sm flex-1 whitespace-pre-wrap font-serif leading-relaxed text-foreground/90 pt-0.5 pl-2">
                                                {quote}
                                            </p>
                                            <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all transform scale-95 group-hover:scale-100 -mr-2 -mt-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10"
                                                    onClick={() => startEditing(index, quote)}
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDeleteQuote(index)}
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
                    {t('settings.appearance.customQuotes.description') || "These quotes will appear randomly in the Inspiration Modal."}
                </p>
            </div>
        </div>
    );
}
