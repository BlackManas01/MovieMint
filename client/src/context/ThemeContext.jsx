// context/ThemeContext.jsx - App is dark-only. Provider kept for API compatibility.
import { createContext, useContext, useEffect, useCallback } from "react";

const ThemeContext = createContext({ theme: "dark", toggleTheme: () => {}, setTheme: () => {} });

export const ThemeProvider = ({ children }) => {
  const theme = "dark";

  // Always apply the dark theme (overrides any previously saved 'light' choice).
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light");
    root.classList.add("dark");
    try {
      localStorage.setItem("theme", "dark");
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback(() => {}, []);
  const toggleTheme = useCallback(() => {}, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
