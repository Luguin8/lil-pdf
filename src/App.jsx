// src/App.jsx
import { useState, useEffect, useCallback } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { ToastProvider } from "./components/Toast";
import MergeTool from "./components/MergeTool";
import SplitTool from "./components/SplitTool";
import OrganizeTool from "./components/OrganizeTool";
import "./App.css";

// Definición de herramientas con metadata
const tools = {
  merge: {
    title: "Unir PDFs",
    desc: "Combina múltiples archivos PDF en un solo documento consolidado.",
    how: "Cargá todos los archivos que quieras unir. El orden en la lista será el orden del documento final.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 17.25h7.5" />
      </svg>
    ),
  },
  split: {
    title: "Dividir PDF",
    desc: "Extraé páginas específicas o dividí un archivo grande en varios documentos.",
    how: "Cargá un archivo PDF. Después elegí si querés extraer un rango de páginas o dividir cada cierta cantidad.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
  organize: {
    title: "Organizar Páginas",
    desc: "Visualizá todas las páginas para reordenar, rotar o eliminar lo que no sirve.",
    how: "Cargá un PDF y vas a ver todas sus páginas. Arrastrá para reordenar, usá los botones para rotar o eliminar.",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
      </svg>
    ),
  },
};

function AppContent() {
  const [activeTool, setActiveTool] = useState("merge");
  const [isDragging, setIsDragging] = useState(false);
  const [droppedPaths, setDroppedPaths] = useState([]);

  // --- Tauri native drag-and-drop ---
  useEffect(() => {
    let unlisten;

    const setupDragDrop = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === "enter") {
            setIsDragging(true);
          } else if (event.payload.type === "leave") {
            setIsDragging(false);
          } else if (event.payload.type === "drop") {
            setIsDragging(false);
            const paths = event.payload.paths || [];
            // Filtrar solo archivos .pdf
            const pdfPaths = paths.filter((p) =>
              p.toLowerCase().endsWith(".pdf")
            );
            if (pdfPaths.length > 0) {
              setDroppedPaths(pdfPaths);
            }
          }
        });
      } catch (error) {
        console.error("Error configurando drag-drop nativo:", error);
      }
    };

    setupDragDrop();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const handleClearDropped = useCallback(() => {
    setDroppedPaths([]);
  }, []);

  const handleToolChange = (toolId) => {
    setActiveTool(toolId);
    setDroppedPaths([]);
  };

  // Renderizar la herramienta activa
  const renderTool = () => {
    const props = {
      droppedPaths,
      onDroppingHandled: handleClearDropped,
    };

    switch (activeTool) {
      case "merge":
        return <MergeTool {...props} />;
      case "split":
        return <SplitTool {...props} />;
      case "organize":
        return <OrganizeTool {...props} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-neutral-900 text-neutral-200 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shadow-xl z-20 shrink-0">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter text-white italic">
            LIL-PDF
          </h1>
          <div className="h-1 w-8 bg-neutral-700 mt-2 rounded-full" />
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {Object.entries(tools).map(([id, tool]) => (
            <button
              key={id}
              onClick={() => handleToolChange(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group cursor-pointer ${activeTool === id
                  ? "bg-neutral-800 text-white shadow-inner"
                  : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                }`}
            >
              <span
                className={`${activeTool === id
                    ? "text-white"
                    : "text-neutral-600 group-hover:text-neutral-400"
                  }`}
              >
                {tool.icon}
              </span>
              <span className="font-medium tracking-tight text-sm">
                {tool.title}
              </span>
            </button>
          ))}
        </nav>

        <div className="p-6">
          <div className="p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800/50 text-center">
            <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-bold mb-2">
              Apoya el proyecto
            </p>
            <p className="text-[#a3a3a3] text-xs leading-relaxed space-y-1.5 flex flex-col">
              <span>Si te sirvió mi app,</span>
              <a href="https://paypal.me/lugomartin" target="_blank" rel="noopener noreferrer" className="bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg py-1.5 px-2 transition-colors font-semibold shadow-sm">
                Donar por PayPal
              </a>
              <a href="https://cafecito.app/lugomartin" target="_blank" rel="noopener noreferrer" className="bg-neutral-800 hover:bg-[#ffe3ae] hover:text-black text-white rounded-lg py-1.5 px-2 transition-colors font-semibold shadow-sm">
                Cafecito (Pesos 🇦🇷)
              </a>
              <a href="mailto:lugoamartin@gmail.com" className="bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg py-1.5 px-2 transition-colors font-semibold shadow-sm mt-2">
                lugoamartin@gmail.com
              </a>
            </p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Drag overlay (Tauri native) */}
        {isDragging && (
          <div className="drag-overlay">
            <svg
              className="drag-overlay-icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <p className="text-3xl font-bold text-white tracking-tight">
              ¡Soltá aquí!
            </p>
            <p className="text-neutral-400 mt-2 text-sm">
              Solo archivos PDF
            </p>
          </div>
        )}

        <div className="p-10 max-w-5xl w-full mx-auto flex-1 flex flex-col min-h-0">
          {/* Header de la herramienta activa */}
          <header className="mb-8 shrink-0">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-neutral-800 rounded-2xl text-white shadow-lg">
                {tools[activeTool].icon}
              </div>
              <div>
                <h2 className="text-4xl font-bold text-white tracking-tight leading-none">
                  {tools[activeTool].title}
                </h2>
                <p className="text-neutral-400 text-lg mt-2 font-medium">
                  {tools[activeTool].desc}
                </p>
              </div>
            </div>

            <div className="bg-neutral-800/30 border-l-2 border-neutral-700 p-4 rounded-r-xl">
              <p className="text-sm text-neutral-400 leading-relaxed italic">
                <span className="text-neutral-200 font-semibold not-italic">
                  ¿Cómo funciona?{" "}
                </span>
                {tools[activeTool].how}
              </p>
            </div>
          </header>

          {/* Contenido de la herramienta activa */}
          {renderTool()}
        </div>
      </main>
    </div>
  );
}

// Wrapper con ToastProvider
function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

export default App;