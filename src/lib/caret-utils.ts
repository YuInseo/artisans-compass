/**
 * Returns the x, y coordinates of the caret in a textarea.
 * Replicates the textarea's styles to a hidden div to calculate position.
 */
export function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
    const div = document.createElement('div');
    const style = getComputedStyle(element);

    // Copy styles to replicate the textarea exactly
    Array.from(style).forEach((prop) => {
        div.style.setProperty(prop, style.getPropertyValue(prop), style.getPropertyPriority(prop));
    });

    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.overflow = 'hidden';

    // We only need the text before the caret
    div.textContent = element.value.substring(0, position);

    // Create a span for the caret position
    const span = document.createElement('span');
    span.textContent = element.value.substring(position) || '.'; // Add a character to ensure height if empty
    div.appendChild(span);

    document.body.appendChild(div);



    // Actually, simpler approach:
    // Create a mirror div, set text up to caret.
    // Insert a specific marker element at the end.
    // Get marker's position relative to the div.

    // Better library-free implementation:
    // 1. Copy styles.
    // 2. Set content to substring(0, pos).
    // 3. Append span.
    // 4. Coordinates = span.offsetLeft, span.offsetTop.

    const coordinates = {
        top: span.offsetTop + parseInt(style.borderTopWidth),
        left: span.offsetLeft + parseInt(style.borderLeftWidth),
        height: parseInt(style.lineHeight)
    };

    document.body.removeChild(div);

    return coordinates;
}

/**
 * Improved version that accounts for scrolling and viewport
 */
export function getCaretAbsolutePosition(element: HTMLTextAreaElement) {
    const { selectionStart } = element;
    const { top, left, height } = getCaretCoordinates(element, selectionStart);
    const rect = element.getBoundingClientRect();

    return {
        top: rect.top + top - element.scrollTop,
        left: rect.left + left - element.scrollLeft,
        height: height
    };
}
