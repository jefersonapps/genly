/**
 * Returns a greeting based on the current time of day.
 * 
 * Logic:
 * - 05:00 to 11:59: "Bom dia"
 * - 12:00 to 17:59: "Boa tarde"
 * - 18:00 to 04:59: "Boa noite"
 * 
 * If a name is provided, it formats the greeting as: "Greeting, Name!"
 * If no name is provided, it returns just: "Greeting!"
 * 
 * @param name Optional name to include in the greeting
 * @returns Formatted greeting string
 */
export function getGreeting(name?: string): string {
    const hour = new Date().getHours();
    
    let greeting = "";
    
    if (hour >= 5 && hour < 12) {
        greeting = "Bom dia";
    } else if (hour >= 12 && hour < 18) {
        greeting = "Boa tarde";
    } else {
        greeting = "Boa noite";
    }

    if (name && name.trim().length > 0) {
        return `${greeting}, ${name.trim()}!`;
    }

    return `${greeting}!`;
}
