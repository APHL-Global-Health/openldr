export const getCurrentTheme = (): "light" | "dark" => {
  if (document.documentElement.classList.contains("dark")) return "dark";
  if (document.documentElement.classList.contains("light")) return "light";
  if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
  return "light";
};

export const handleThemeChange = (value: "light" | "dark" | "system") => {
  requestAnimationFrame(() => {
    localStorage.setItem("theme", value);

    if (
      document.documentElement.classList.contains("dark") ===
      (value === "dark")
    ) {
      document.documentElement.classList.remove("light");
    } else if (value === "light") {
      document.documentElement.classList.add("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
    }

    window.dispatchEvent(new CustomEvent("themechange"));
  });
};
