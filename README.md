# Kevin Li | Personal Portfolio

A personal portfolio site built with React, TypeScript, and Vite, deployed on Vercel.

## Live Website

- https://kevinli-kl.me

---

## Key Features

The portfolio interface mirrors a computer terminal, presenting projects and experience in a interactive format. The experience combines a shell-style command surface, animated matrix rain visuals, and a custom cursor treatment to give the site a distinct developer-focused identity.

- A terminal-style command surface built in React, where commands such as `help`, `theme`, `cat`, and `open` control navigation and interaction.
- A canvas-based matrix rain effect can be toggled through the on-screen terminal.
- A blinking terminal cursor and inline prompt treatment that mimic the feel of a real command line.
- Lofi and rain audio stations can be selected from the navigation bar, and the play/pause state is preserved in-session so the session resumes from the same position. On refresh, the audio restarts from a random playback position.
- Keyboard click sounds are synthesized using lightweight generated audio buffers.
- Subtle details, such as auto-complete while typing, complement the overall user experience.
- Mobile-specific terminal behavior, including keyboard-safe viewport adjustments and a resizable command panel for smaller screens.

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite |
| Styling | Tailwind CSS |
| Icons / UI | Lucide React |
| Build / Tooling | npm, TypeScript compiler, Vite |
| Hosting | Vercel |

---

## Project Structure

```text
personal-website/
├── public/               # Static assets and site files
├── src/                  # App source code, components, and styling
│   ├── App.tsx           # Main portfolio layout
│   ├── Terminal.tsx      # Interactive terminal component
│   ├── MatrixRain.tsx    # Animated background effect
│   └── index.css         # Global styles and theme variables
├── index.html            # Vite entry HTML
├── package.json          # Scripts and dependencies
└── vite.config.ts        # Vite configuration
```

---

## Deployment

This portfolio is deployed on Vercel as a static frontend. Production updates are published through the configured Vercel deployment flow.

---

## Contact

- GitHub: https://github.com/kevinli808
- LinkedIn: https://www.linkedin.com/in/kevinli-kl/
- Email: kevin.shangkun.li@gmail.com

If you’d like to collaborate or discuss a project, feel free to reach out.