const fs = require('fs');
const path = require('path');

const locales = ['ko', 'en', 'ja'];
const translations = {
    ko: {
        sidebar: { pomodoroView: "포모도로 뷰" },
        dashboard: { pomodoro: "포모도로" },
        pomodoro: {
            selectTask: "포모도로를 시작할 항목을 선택해주세요.",
            overview: "개요",
            todayPomos: "오늘의 포모스",
            todayFocus: "오늘의 포커스",
            focusLog: "집중 기록",
            focusNotes: "집중 노트",
            notesPlaceholder: "당신의 생각을 기록해보세요... 무슨 생각이 있나요?"
        }
    },
    en: {
        sidebar: { pomodoroView: "Pomodoro View" },
        dashboard: { pomodoro: "Pomodoro" },
        pomodoro: {
            selectTask: "Please select a task to start Pomodoro.",
            overview: "Overview",
            todayPomos: "Today's Pomodoros",
            todayFocus: "Today's Focus",
            focusLog: "Focus Log",
            focusNotes: "Focus Notes",
            notesPlaceholder: "Record your thoughts... What's on your mind?"
        }
    },
    ja: {
        sidebar: { pomodoroView: "ポモドーロビュー" },
        dashboard: { pomodoro: "ポモドーロ" },
        pomodoro: {
            selectTask: "ポモドーロを開始する項目を選択してください。",
            overview: "概要",
            todayPomos: "今日のポモドーロ",
            todayFocus: "今日のフォーカス",
            focusLog: "集中記録",
            focusNotes: "集中ノート",
            notesPlaceholder: "あなたの考えを記録してみてください... 何を考えていますか？"
        }
    }
};

locales.forEach(lang => {
    const filePath = path.join(__dirname, 'src', 'locales', `${lang}.json`);
    let content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    if (!content.sidebar) content.sidebar = {};
    content.sidebar.pomodoroView = translations[lang].sidebar.pomodoroView;

    if (!content.dashboard) content.dashboard = {};
    content.dashboard.pomodoro = translations[lang].dashboard.pomodoro;

    content.pomodoro = translations[lang].pomodoro;

    fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
});
console.log('Translations added successfully!');
