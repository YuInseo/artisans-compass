import activeWin from 'active-win';

(async () => {
    try {
        const win = await activeWin();
        console.log("Active Window:", win);
    } catch (e) {
        console.error("Error:", e);
    }
})();
