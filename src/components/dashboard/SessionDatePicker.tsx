import React, { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { ko } from "date-fns/locale";
import { Clock, Check, ChevronRight, Repeat, Sun, Moon, Sunrise, CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { RecurrenceRule } from "@/types";

interface SessionDatePickerProps {
    start: number; // timestamp
    duration: number; // seconds
    onSave: (updates: { start: number; duration: number; alert?: number; isAllDay?: boolean; recurrence?: RecurrenceRule }) => void;
    onClose: () => void;
    onDelete?: () => void;
    alert?: number;
    recurrence?: RecurrenceRule;
}

export function SessionDatePicker({ start, duration, onSave, onClose, onDelete, alert, recurrence }: SessionDatePickerProps) {
    const [mode, setMode] = useState<'date' | 'duration'>('date');

    // Core state
    const [startDate, setStartDate] = useState<Date>(new Date(start));

    // Duration state (minutes)
    const [durationMins, setDurationMins] = useState(Math.round(duration / 60));

    // Alert state
    const [alertVal, setAlertVal] = useState<number | undefined>(alert);
    const [isAlertOpen, setIsAlertOpen] = useState(false);

    // Recurrence state
    const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | undefined>(recurrence);
    const [isRecurrenceOpen, setIsRecurrenceOpen] = useState(false);

    // Time picker state
    const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

    // Initial load
    useEffect(() => {
        setStartDate(new Date(start));
        setDurationMins(Math.round(duration / 60));
    }, [start, duration]);

    // Handlers
    const handleDateSelect = (date: Date | undefined) => {
        if (!date) return;
        const newStart = new Date(startDate);
        newStart.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        setStartDate(newStart);
    };

    const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const [hours, mins] = e.target.value.split(':').map(Number);
        if (isNaN(hours) || isNaN(mins)) return;

        const newStart = new Date(startDate);
        newStart.setHours(hours);
        newStart.setMinutes(mins);
        setStartDate(newStart);
    };

    const handleQuickDate = (type: 'today' | 'tomorrow' | 'nextWeek' | 'later') => {
        const now = new Date();
        const currentTime = { h: startDate.getHours(), m: startDate.getMinutes() };
        let newDate = new Date(now);

        switch (type) {
            case 'today':
                newDate = now;
                break;
            case 'tomorrow':
                newDate = addDays(now, 1);
                break;
            case 'nextWeek':
                newDate = addDays(now, 7);
                break;
            case 'later':
                // For "later", maybe set to evening? Or just keep current logic
                newDate.setHours(19, 0, 0, 0); // 7 PM
                setStartDate(newDate);
                return;
        }

        // Preserve time
        newDate.setHours(currentTime.h, currentTime.m);
        setStartDate(newDate);
    };

    // Helper for Duration mode
    const [activePopover, setActivePopover] = useState<'start-date' | 'start-time' | 'end-date' | 'end-time' | null>(null);

    const handleDurationDateChange = (type: 'start' | 'end', date: Date | undefined) => {
        if (!date) return;
        if (type === 'start') {
            const newStart = new Date(date);
            newStart.setHours(startDate.getHours(), startDate.getMinutes());
            setStartDate(newStart);
        } else {
            const endTime = new Date(startDate.getTime() + durationMins * 60000);
            const newEndDate = new Date(date);
            newEndDate.setHours(endTime.getHours(), endTime.getMinutes());

            const diffMins = Math.round((newEndDate.getTime() - startDate.getTime()) / 60000);
            if (diffMins > 0) setDurationMins(diffMins);
        }
        setActivePopover(null);
    };

    const handleDurationTimeChange = (type: 'start' | 'end', e: React.ChangeEvent<HTMLInputElement>) => {
        const [hours, mins] = e.target.value.split(':').map(Number);
        if (isNaN(hours) || isNaN(mins)) return;

        if (type === 'start') {
            const newStart = new Date(startDate);
            newStart.setHours(hours, mins);
            setStartDate(newStart);
        } else {
            const newEndDate = new Date(startDate.getTime() + durationMins * 60000);
            newEndDate.setHours(hours, mins);

            // If new end time is before start time (on same day), assume next day? 
            // Or just calculate diff. If diff is negative, maybe user meant tomorrow? 
            // For now, simple diff.
            let diffMins = Math.round((newEndDate.getTime() - startDate.getTime()) / 60000);
            if (diffMins < 0) {
                // If negative, maybe they meant the next day?
                // But typically UI limits this.
                // Let's just allow it (it will be negative duration -> invalid? or handled?)
                // If negative, add 24 hours?
                diffMins += 24 * 60;
            }
            if (diffMins > 0) setDurationMins(diffMins);
        }
    };

    const handleSave = () => {
        onSave({
            start: startDate.getTime(),
            duration: durationMins * 60,
            alert: alertVal,
            recurrence: recurrenceRule
        });
        onClose();
    };

    const getRecurrenceLabel = (rule?: RecurrenceRule) => {
        if (!rule) return "안 함";
        switch (rule.freq) {
            case 'daily':
                if (rule.byWeekDay) return "매일 평일 (월-금)";
                return "매일";
            case 'weekly':
                return `매주 (${format(startDate, 'eee', { locale: ko })})`;
            case 'monthly':
                return `매월 (${format(startDate, 'd일')})`;
            case 'yearly':
                return `매년 (${format(startDate, 'M월 d일')})`;
            default:
                return "사용자 설정";
        }
    };



    return (
        <div className="w-[320px] flex flex-col font-sans bg-zinc-950/90 backdrop-blur-xl border border-white/10 text-zinc-100 rounded-xl overflow-hidden shadow-2xl">
            {/* Header / Tabs - Integrated */}
            <div className="p-3 bg-white/5 border-b border-white/5">
                <div className="flex p-1 bg-black/40 rounded-lg">
                    <button
                        onClick={() => setMode('date')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-300 relative overflow-hidden",
                            mode === 'date'
                                ? "bg-zinc-800 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                        )}
                    >
                        날짜
                    </button>
                    <button
                        onClick={() => setMode('duration')}
                        className={cn(
                            "flex-1 py-1.5 text-xs font-semibold rounded-md transition-all duration-300 relative overflow-hidden",
                            mode === 'duration'
                                ? "bg-zinc-800 text-white shadow-sm"
                                : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                        )}
                    >
                        지속 시간
                    </button>
                </div>
            </div>

            {mode === 'date' ? (
                <div className="p-4 space-y-4">
                    {/* Quick Actions */}
                    <div className="flex justify-between px-2 gap-2">
                        {[
                            { id: 'today', icon: Sun, label: '오늘' },
                            { id: 'tomorrow', icon: Sunrise, label: '내일' },
                            { id: 'nextWeek', icon: CalendarDays, label: '다음 주' },
                            { id: 'later', icon: Moon, label: '나중에' }
                        ].map((action) => (
                            <Button
                                key={action.id}
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all duration-200 active:scale-95"
                                onClick={() => handleQuickDate(action.id as any)}
                                title={action.label}
                            >
                                <action.icon className="w-4 h-4" />
                            </Button>
                        ))}
                    </div>

                    {/* Calendar */}
                    <div className="flex justify-center bg-black/20 rounded-2xl p-3 border border-white/5">
                        <Calendar
                            mode="single"
                            locale={ko}
                            selected={startDate}
                            onSelect={handleDateSelect}
                            className="rounded-md border-none shadow-none p-0"
                            classNames={{
                                head_cell: "text-zinc-500 w-9 font-medium text-[0.8rem]",
                                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-white/5 [&:has([aria-selected])]:bg-white/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                day: cn(
                                    "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-white/10 rounded-full transition-colors text-zinc-300 hover:text-white"
                                ),
                                day_selected:
                                    "bg-blue-600 text-white hover:bg-blue-500 focus:bg-blue-600 rounded-full shadow-lg shadow-blue-500/20",
                                day_today: "bg-white/10 text-white rounded-full font-bold",
                            }}
                        />
                    </div>

                    {/* Options List */}
                    <div className="space-y-1">
                        {/* Time */}
                        <Popover open={isTimePickerOpen} onOpenChange={setIsTimePickerOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between font-normal h-10 hover:bg-white/5 px-3 rounded-lg text-zinc-300 hover:text-white group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                            <Clock className="w-4 h-4 text-blue-400" />
                                        </div>
                                        <span className="text-sm">{format(startDate, 'hh:mm a')}</span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-2 bg-zinc-900 border-zinc-800 text-zinc-200" align="start">
                                <Input
                                    type="time"
                                    value={format(startDate, 'HH:mm')}
                                    onChange={handleTimeChange}
                                    className="w-[120px] bg-zinc-950 border-zinc-800 text-white"
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Alert */}
                        <Popover open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between font-normal h-10 hover:bg-white/5 px-3 rounded-lg text-zinc-300 hover:text-white group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", alertVal !== undefined ? "bg-orange-500/10 group-hover:bg-orange-500/20" : "bg-white/5 group-hover:bg-white/10")}>
                                            <Clock className={cn("w-4 h-4", alertVal !== undefined ? "text-orange-400" : "text-zinc-500")} />
                                        </div>
                                        <span className={cn("text-sm transition-colors", alertVal !== undefined ? "text-orange-400" : "")}>
                                            {alertVal === undefined ? '설정 안 함' :
                                                alertVal === 0 ? '정각에' :
                                                    alertVal < 60 ? `${alertVal}분 전` :
                                                        `${Math.floor(alertVal / 60)}시간 전`
                                            }
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1 bg-zinc-900 border-zinc-800 text-zinc-200" align="start">
                                <div className="flex flex-col gap-1">
                                    {[undefined, 0, 5, 10, 15, 30, 60].map((mins) => (
                                        <Button
                                            key={String(mins)}
                                            variant="ghost"
                                            size="sm"
                                            className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white"
                                            onClick={() => {
                                                setAlertVal(mins);
                                                setIsAlertOpen(false);
                                            }}
                                        >
                                            {mins === undefined ? '설정 안 함' :
                                                mins === 0 ? '정각에' :
                                                    mins < 60 ? `${mins}분 전` :
                                                        `${Math.floor(mins / 60)}시간 전`
                                            }
                                            {alertVal === mins && <Check className="ml-auto w-3 h-3 text-orange-400" />}
                                        </Button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Recurrence */}
                        <Popover open={isRecurrenceOpen} onOpenChange={setIsRecurrenceOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between font-normal h-10 hover:bg-white/5 px-3 rounded-lg text-zinc-300 hover:text-white group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors", recurrenceRule ? "bg-green-500/10 group-hover:bg-green-500/20" : "bg-white/5 group-hover:bg-white/10")}>
                                            <Repeat className={cn("w-4 h-4", recurrenceRule ? "text-green-400" : "text-zinc-500")} />
                                        </div>
                                        <span className={cn("text-sm transition-colors", recurrenceRule ? "text-green-400" : "")}>
                                            {recurrenceRule ? getRecurrenceLabel(recurrenceRule) : "반복"}
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-1 bg-zinc-900 border-zinc-800 text-zinc-200" align="start">
                                <div className="flex flex-col gap-1">
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'daily', interval: 1 }); setIsRecurrenceOpen(false); }}>
                                        매일
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'weekly', interval: 1 }); setIsRecurrenceOpen(false); }}>
                                        매주 ({format(startDate, 'eee', { locale: ko })})
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'monthly', interval: 1 }); setIsRecurrenceOpen(false); }}>
                                        매월 ({format(startDate, 'd일')})
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'yearly', interval: 1 }); setIsRecurrenceOpen(false); }}>
                                        매년 ({format(startDate, 'M월 d일')})
                                    </Button>
                                    <div className="h-[1px] bg-white/10 my-0.5" />
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'daily', interval: 1, byWeekDay: [1, 2, 3, 4, 5] }); setIsRecurrenceOpen(false); }}>
                                        매일 평일 (월-금)
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule(undefined); setIsRecurrenceOpen(false); }}>
                                        안 함
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            ) : (
                /* Duration Mode -> Start/End Time Editor Style */
                <div className="p-4 space-y-4">
                    {/* Start Time */}
                    <div className="flex items-center justify-between">
                        <Label className="text-zinc-400 w-12 text-sm">시작</Label>
                        <div className="flex gap-2 flex-1">
                            <Popover open={activePopover === 'start-date'} onOpenChange={(open) => setActivePopover(open ? 'start-date' : null)}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10 h-9 text-sm font-normal justify-start px-3">
                                        {format(startDate, 'MM/dd')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-none shadow-none" align="start">
                                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl">
                                        <Calendar
                                            mode="single"
                                            locale={ko}
                                            selected={startDate}
                                            onSelect={(d) => handleDurationDateChange('start', d)}
                                            initialFocus
                                            className="rounded-md border-none shadow-none p-0"
                                            classNames={{
                                                head_cell: "text-zinc-500 w-9 font-medium text-[0.8rem]",
                                                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-white/5 [&:has([aria-selected])]:bg-white/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-white/10 rounded-full transition-colors text-zinc-300 hover:text-white",
                                                day_selected: "bg-blue-600 text-white hover:bg-blue-500 focus:bg-blue-600 rounded-full shadow-lg shadow-blue-500/20",
                                                day_today: "bg-white/10 text-white rounded-full font-bold",
                                            }}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Popover open={activePopover === 'start-time'} onOpenChange={(open) => setActivePopover(open ? 'start-time' : null)}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10 h-9 text-sm font-normal justify-start px-3">
                                        {format(startDate, 'hh:mm a')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2 bg-zinc-900 border-zinc-800 text-zinc-200" align="start">
                                    <Input
                                        type="time"
                                        value={format(startDate, 'HH:mm')}
                                        onChange={(e) => handleDurationTimeChange('start', e)}
                                        className="w-[120px] bg-zinc-950 border-zinc-800 text-white"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* End Time */}
                    <div className="flex items-center justify-between">
                        <Label className="text-zinc-400 w-12 text-sm">끝</Label>
                        <div className="flex gap-2 flex-1">
                            <Popover open={activePopover === 'end-date'} onOpenChange={(open) => setActivePopover(open ? 'end-date' : null)}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10 h-9 text-sm font-normal justify-start px-3">
                                        {format(addDays(startDate, Math.floor((startDate.getHours() * 60 + startDate.getMinutes() + durationMins) / 1440)), 'MM/dd')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 border-none shadow-none" align="start">
                                    <div className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl">
                                        <Calendar
                                            mode="single"
                                            locale={ko}
                                            selected={new Date(startDate.getTime() + durationMins * 60000)}
                                            onSelect={(d) => handleDurationDateChange('end', d)}
                                            initialFocus
                                            className="rounded-md border-none shadow-none p-0"
                                            classNames={{
                                                head_cell: "text-zinc-500 w-9 font-medium text-[0.8rem]",
                                                cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-white/5 [&:has([aria-selected])]:bg-white/10 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                                                day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-white/10 rounded-full transition-colors text-zinc-300 hover:text-white",
                                                day_selected: "bg-blue-600 text-white hover:bg-blue-500 focus:bg-blue-600 rounded-full shadow-lg shadow-blue-500/20",
                                                day_today: "bg-white/10 text-white rounded-full font-bold",
                                            }}
                                        />
                                    </div>
                                </PopoverContent>
                            </Popover>

                            <Popover open={activePopover === 'end-time'} onOpenChange={(open) => setActivePopover(open ? 'end-time' : null)}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="flex-1 bg-white/5 border-white/10 text-zinc-200 hover:bg-white/10 h-9 text-sm font-normal justify-start px-3">
                                        {format(new Date(startDate.getTime() + durationMins * 60000), 'hh:mm a')}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-2 bg-zinc-900 border-zinc-800 text-zinc-200" align="start">
                                    <Input
                                        type="time"
                                        value={format(new Date(startDate.getTime() + durationMins * 60000), 'HH:mm')}
                                        onChange={(e) => handleDurationTimeChange('end', e)}
                                        className="w-[120px] bg-zinc-950 border-zinc-800 text-white"
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* All Day Toggle */}
                    <div className="flex items-center justify-between py-1">
                        <Label className="text-zinc-400 text-sm">종일</Label>
                        <Switch />
                    </div>

                    <div className="h-[1px] bg-white/10 my-2" />

                    {/* Options List - Reused */}
                    <div className="space-y-1">
                        {/* Alert */}
                        <Popover open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between font-normal h-10 hover:bg-white/5 px-2 rounded-lg text-zinc-300 hover:text-white group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-colors", alertVal !== undefined ? "bg-orange-500/10" : "bg-transparent")}>
                                            <Clock className={cn("w-4 h-4", alertVal !== undefined ? "text-orange-400" : "text-blue-400")} />
                                        </div>
                                        <span className={cn("text-sm transition-colors", alertVal !== undefined ? "text-orange-400" : "text-blue-400")}>
                                            {alertVal === undefined ? '정각에' :
                                                alertVal === 0 ? '정각에' :
                                                    alertVal < 60 ? `${alertVal}분 전` :
                                                        `${Math.floor(alertVal / 60)}시간 전`
                                            }
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1 bg-zinc-900 border-zinc-800 text-zinc-200" align="start">
                                <div className="flex flex-col gap-1">
                                    {[undefined, 0, 5, 10, 15, 30, 60].map((mins) => (
                                        <Button
                                            key={String(mins)}
                                            variant="ghost"
                                            size="sm"
                                            className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white"
                                            onClick={() => {
                                                setAlertVal(mins);
                                                setIsAlertOpen(false);
                                            }}
                                        >
                                            {mins === undefined ? '설정 안 함' :
                                                mins === 0 ? '정각에' :
                                                    mins < 60 ? `${mins}분 전` :
                                                        `${Math.floor(mins / 60)}시간 전`
                                            }
                                            {alertVal === mins && <Check className="ml-auto w-3 h-3 text-orange-400" />}
                                        </Button>
                                    ))}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Recurrence */}
                        <Popover open={isRecurrenceOpen} onOpenChange={setIsRecurrenceOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" className="w-full justify-between font-normal h-10 hover:bg-white/5 px-2 rounded-lg text-zinc-300 hover:text-white group transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-7 h-7 rounded-md flex items-center justify-center bg-transparent">
                                            <Repeat className="w-4 h-4 text-zinc-400" />
                                        </div>
                                        <span className="text-sm text-zinc-400">
                                            {recurrenceRule ? getRecurrenceLabel(recurrenceRule) : "반복"}
                                        </span>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-1 bg-zinc-900 border-zinc-800 text-zinc-200" align="start">
                                <div className="flex flex-col gap-1">
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'daily', interval: 1 }); setIsRecurrenceOpen(false); }}>
                                        매일
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'weekly', interval: 1 }); setIsRecurrenceOpen(false); }}>
                                        매주 ({format(startDate, 'eee', { locale: ko })})
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'monthly', interval: 1 }); setIsRecurrenceOpen(false); }}>
                                        매월 ({format(startDate, 'd일')})
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'yearly', interval: 1 }); setIsRecurrenceOpen(false); }}>
                                        매년 ({format(startDate, 'M월 d일')})
                                    </Button>
                                    <div className="h-[1px] bg-white/10 my-0.5" />
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule({ freq: 'daily', interval: 1, byWeekDay: [1, 2, 3, 4, 5] }); setIsRecurrenceOpen(false); }}>
                                        매일 평일 (월-금)
                                    </Button>
                                    <Button variant="ghost" size="sm" className="justify-start h-8 font-normal text-xs hover:bg-white/10 hover:text-white" onClick={() => { setRecurrenceRule(undefined); setIsRecurrenceOpen(false); }}>
                                        안 함
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="p-4 bg-white/5 border-t border-white/5 flex gap-3">
                <Button className="flex-1 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25 border-none h-10" onClick={handleSave}>
                    확인
                </Button>
                {onDelete && (
                    <Button variant="outline" className="flex-1 text-red-400 border-white/10 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/20 h-10 bg-transparent" onClick={() => { onDelete(); onClose(); }}>
                        삭제
                    </Button>
                )}
            </div>
        </div>
    );
}
