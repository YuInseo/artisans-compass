import { useState } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Quote } from 'lucide-react';

export function QuoteManager() {
    const { settings, saveSettings } = useDataStore();
    const [newQuote, setNewQuote] = useState('');

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

    return (
        <div className="space-y-4">
            <div className="flex gap-2">
                <Input
                    placeholder="Enter a new quote..."
                    value={newQuote}
                    onChange={(e) => setNewQuote(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddQuote()}
                    className="flex-1"
                />
                <Button onClick={handleAddQuote} disabled={!newQuote.trim()}>
                    <Plus className="w-4 h-4 mr-2" /> Add
                </Button>
            </div>

            <div className="border rounded-md">
                <ScrollArea className="h-[300px] w-full p-4">
                    {quotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 space-y-2 min-h-[100px]">
                            <Quote className="w-8 h-8" />
                            <p>No custom quotes added yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {quotes.map((quote, index) => (
                                <div key={index} className="flex items-start justify-between p-3 bg-card/50 rounded-lg group hover:bg-card transition-colors border border-border/50">
                                    <p className="text-sm flex-1 mr-4 whitespace-pre-wrap font-serif">"{quote}"</p>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => handleDeleteQuote(index)}
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
                These quotes will appear randomly in the Inspiration Modal.
            </p>
        </div>
    );
}
