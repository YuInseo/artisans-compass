import { useState } from 'react';
import { QuoteManager } from './QuoteManager';
import { ReminderManager } from './ReminderManager';
import { ChevronDown, ChevronRight, Quote, Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function QuotesRemindersTab() {
    const { t } = useTranslation();
    const [openCard, setOpenCard] = useState<'quotes' | 'reminders' | null>('quotes');

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Quotes Card */}
            <div className={`border rounded-xl overflow-hidden shadow-sm transition-all duration-300 ${openCard === 'quotes' ? 'border-primary/50 ring-1 ring-primary/20 bg-background' : 'border-border/50 bg-background/50 hover:border-border/80'}`}>
                <button
                    onClick={() => setOpenCard(openCard === 'quotes' ? null : 'quotes')}
                    className="w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/30"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${openCard === 'quotes' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Quote className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h3 className={`text-base font-semibold ${openCard === 'quotes' ? 'text-foreground' : 'text-foreground/80'}`}>
                                {t('settings.appearance.customQuotes.title') || "Custom Quotes"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {t('settings.appearance.customQuotes.description', 'Manage daily inspirational quotes.')}
                            </p>
                        </div>
                    </div>
                    {openCard === 'quotes' ? (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <ChevronDown className="w-5 h-5 text-primary" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/80">
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                    )}
                </button>

                <div
                    className={`grid transition-all duration-300 ease-in-out ${openCard === 'quotes' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                    <div className="overflow-hidden">
                        <div className="p-4 pt-1 border-t border-border/50 bg-background/50">
                            <QuoteManager />
                        </div>
                    </div>
                </div>
            </div>

            {/* Reminders Card */}
            <div className={`border rounded-xl overflow-hidden shadow-sm transition-all duration-300 ${openCard === 'reminders' ? 'border-primary/50 ring-1 ring-primary/20 bg-background' : 'border-border/50 bg-background/50 hover:border-border/80'}`}>
                <button
                    onClick={() => setOpenCard(openCard === 'reminders' ? null : 'reminders')}
                    className="w-full flex items-center justify-between p-4 transition-colors hover:bg-muted/30"
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg transition-colors ${openCard === 'reminders' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            <Bell className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                            <h3 className={`text-base font-semibold ${openCard === 'reminders' ? 'text-foreground' : 'text-foreground/80'}`}>
                                {t('settings.appearance.reminders.title') || "Reminders"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {t('settings.appearance.reminders.description', 'Set up daily notifications.')}
                            </p>
                        </div>
                    </div>
                    {openCard === 'reminders' ? (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <ChevronDown className="w-5 h-5 text-primary" />
                        </div>
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/80">
                            <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                    )}
                </button>

                <div
                    className={`grid transition-all duration-300 ease-in-out ${openCard === 'reminders' ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
                >
                    <div className="overflow-hidden">
                        <div className="p-4 pt-1 border-t border-border/50 bg-background/50">
                            <ReminderManager />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
