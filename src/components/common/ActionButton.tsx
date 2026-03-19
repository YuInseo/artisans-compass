import React, { useState } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { BaseCommand } from '@/core/Command';
import { useArtisansCompass } from '@/core/ArtisansCompassProvider';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

interface ActionButtonProps extends ButtonProps {
    command: BaseCommand<any>;
    payload?: any;
    tooltip?: string;
    showToast?: boolean;
}

export function ActionButton({
    command,
    payload,
    tooltip,
    showToast = true,
    className,
    children,
    ...props
}: ActionButtonProps) {
    const { t } = useTranslation();
    const core = useArtisansCompass();
    const [isExecuting, setIsExecuting] = useState(false);

    // Ensure the command is registered if it's dynamically passed
    if (!core.commandManager.getCommand(command.id)) {
        core.commandManager.register(command);
    }

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
        if (props.onClick) props.onClick(e);

        try {
            setIsExecuting(true);
            await core.commandManager.execute(command.id, payload);

            if (showToast) {
                toast.success(t(command.name, command.name));
            }
        } catch (error) {
            console.error(`Failed to execute command ${command.id}:`, error);
            toast.error(t('error.commandFailed', 'Action failed'));
        } finally {
            setIsExecuting(false);
        }
    };

    const content = (
        <Button
            className={className}
            disabled={isExecuting || props.disabled}
            onClick={handleClick}
            {...props}
        >
            {children || command.icon}
        </Button>
    );

    if (tooltip) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {content}
                </TooltipTrigger>
                <TooltipContent>
                    <p>{t(tooltip, tooltip)}</p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return content;
}
