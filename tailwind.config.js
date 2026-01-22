/** @type {import('tailwindcss').Config} */
module.exports = {
    mode: "jit",
    darkMode: "class",
    content: ["./**/*.tsx"],
    theme: {
        extend: {
            colors: {
                bridge: {
                    primary: "#6366f1",
                    secondary: "#8b5cf6",
                    accent: "#06b6d4",
                    dark: "#1e1b4b",
                    light: "#f8fafc"
                }
            },
            animation: {
                "fade-in": "fadeIn 0.2s ease-out",
                "slide-up": "slideUp 0.3s ease-out",
                "pulse-subtle": "pulseSubtle 2s ease-in-out infinite"
            },
            keyframes: {
                fadeIn: {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" }
                },
                slideUp: {
                    "0%": { opacity: "0", transform: "translateY(10px)" },
                    "100%": { opacity: "1", transform: "translateY(0)" }
                },
                pulseSubtle: {
                    "0%, 100%": { opacity: "1" },
                    "50%": { opacity: "0.8" }
                }
            }
        }
    },
    plugins: []
}
