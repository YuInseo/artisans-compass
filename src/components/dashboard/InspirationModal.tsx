import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useDataStore } from "@/hooks/useDataStore";

const QUOTES = [
    "창의성은 실수를 허용하는 것이다. 예술은 어떤 것을 지킬지 아는 것이다.",
    "영감은 존재하지만, 일하는 중에 찾아온다.\n- 파블로 피카소",
    "완벽함을 두려워하지 마라. 당신은 절대 도달할 수 없을 테니까.\n- 살바도르 달리",
    "모든 아이는 예술가다. 문제는 어른이 되어서도 예술가로 남을 수 있느냐다.\n- 파블로 피카소",
    "예술은 보이는 것을 재현하는 것이 아니라, 보이게 만드는 것이다.\n- 파울 클레",
    "단순함은 궁극의 정교함이다.\n- 레오나르도 다 빈치",
    "그림은 일기를 쓰는 또 다른 방법일 뿐이다.\n- 파블로 피카소",
    "재능은 소금과 같다. 빵을 만들 때 소금만으로는 빵이 되지 않지만, 소금 없이는 맛이 나지 않는다.",
    "어제보다 나은 그림을 그리는 것이 유일한 목표다.",
    "선의 끝은 없다. 단지 멈출 뿐이다."
];

interface InspirationModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function InspirationModal({ isOpen, onClose }: InspirationModalProps) {
    const { settings } = useDataStore();

    // We want the quote to stay the same while the modal is open, but be correctly initialized
    const [quote, setQuote] = useState("");

    useEffect(() => {
        if (isOpen) {
            const customQuotes = settings?.customQuotes || [];
            const quotesArray = customQuotes.length > 0 ? customQuotes : QUOTES;
            setQuote(quotesArray[Math.floor(Math.random() * quotesArray.length)]);
        }
    }, [isOpen, settings?.customQuotes]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-xl bg-card/95 backdrop-blur-sm border-0 shadow-2xl rounded-2xl p-0 overflow-hidden">
                <div className="flex flex-col items-center justify-center p-10 min-h-[300px] text-center space-y-8 animate-in zoom-in-95 duration-500">
                    <Sparkles className="w-10 h-10 text-blue-400 mb-2 animate-pulse" />

                    <div className="space-y-4 max-w-lg">
                        <h1 className="text-4xl font-serif text-muted-foreground/20 select-none absolute top-10 left-10 -z-10 opacity-50">“</h1>
                        <p className="text-xl md:text-2xl font-medium text-foreground leading-relaxed word-keep-all whitespace-pre-line font-serif">
                            {quote}
                        </p>
                    </div>

                    <div className="w-24 h-1 bg-gradient-to-r from-blue-100 via-blue-200 to-blue-100 rounded-full mx-auto opacity-50"></div>

                    <Button
                        onClick={onClose}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-8 h-12 text-base shadow-lg hover:shadow-xl transition-all group"
                    >
                        Start Day <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
