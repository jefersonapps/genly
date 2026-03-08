/**
 * Adjusts the brightness of a hex color.
 * @param color Hex color string (e.g., "#6a57e3")
 * @param amount Amount to adjust (-255 to 255). Positive lightens, negative darkens.
 * @returns Adjusted hex color string.
 */
export const adjustColor = (color: string, amount: number) => {
    // Strip hash and any alpha (8 digits -> 6, 4 digits -> 3)
    let hex = color.replace(/^#/, '');
    if (hex.length >= 8) hex = hex.substring(0, 6);
    if (hex.length === 4 || hex.length === 5) hex = hex.substring(0, 3);
    
    // Normalize to 6 digits if 3
    if (hex.length === 3) {
        hex = hex.split('').map(s => s + s).join('');
    }

    return '#' + hex.replace(/../g, c => ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).substr(-2));
}

/**
 * Adjusts the hue of a hex color.
 * @param color Hex color string (e.g., "#6a57e3")
 * @param degree Amount to shift hue in degrees (0-360).
 * @returns Adjusted hex color string.
 */
export const adjustHue = (color: string, degree: number) => {
    let hex = color.replace(/^#/, '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;

    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    h = (h * 360 + degree) % 360;
    if (h < 0) h += 360;

    const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    const toHex = (x: number) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    if (s === 0) return color; // Achromatic

    return '#' + toHex(hue2rgb(p, q, h/360 + 1/3)) + toHex(hue2rgb(p, q, h/360)) + toHex(hue2rgb(p, q, h/360 - 1/3));
}

/**
 * Adds opacity to a hex color.
 * @param color Hex color string (e.g., "#6a57e3")
 * @param opacity Opacity value between 0 and 1.
 * @returns Hex color with alpha or original color if not hex.
 */
export const withOpacity = (color: string, opacity: number) => {
    if (!color.startsWith('#')) return color; 
    
    let hex = color.replace(/^#/, '');
    
    // Strip existing alpha if present (8+ digits -> 6, 4+ digits -> 3)
    if (hex.length >= 8) hex = hex.substring(0, 6);
    if (hex.length >= 4 && hex.length <= 5) hex = hex.substring(0, 3);

    // Ensure 6 digits
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    
    const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
    return `#${hex}${alpha}`;
}
