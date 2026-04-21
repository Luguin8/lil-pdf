// src/App.jsx
import { useState } from "react";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { open as openFile } from "@tauri-apps/plugin-opener"; // ¡NUEVO! Plugin para abrir archivos
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

function App() {
  const [activeTool, setActiveTool] = useState("merge");

  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- LÓGICA DE SELECCIÓN DE ARCHIVOS ---
  const handleSelectFiles = async () => {
    try {
      // Usamos el alias openDialog
      const selectedPaths = await openDialog({
        multiple: true,
        filters: [{ name: 'Documentos PDF', extensions: ['pdf'] }]
      });

      if (Array.isArray(selectedPaths)) {
        const newFiles = selectedPaths.map(path => {
          const fileName = path.split(/[\\/]/).pop();
          return {
            id: Math.random().toString(36).substr(2, 9),
            name: fileName,
            path: path,
            size: "Listo para procesar"
          };
        });
        setFiles(prev => [...prev, ...newFiles]);
      }
    } catch (error) {
      console.error("Error al abrir diálogo:", error);
    }
  };

  const handleSelectFolder = async () => {
    try {
      // Usamos el alias openDialog
      const selectedFolder = await openDialog({
        directory: true,
        multiple: false,
      });

      if (selectedFolder) {
        const folderName = selectedFolder.split(/[\\/]/).pop();
        const newFile = {
          id: Math.random().toString(36).substr(2, 9),
          name: `📁 Carpeta: ${folderName}`,
          path: selectedFolder,
          size: "Ruta de carpeta capturada"
        };
        setFiles(prev => [...prev, newFile]);
      }
    } catch (error) {
      console.error("Error al abrir diálogo:", error);
    }
  };

  // --- LÓGICA DE EJECUCIÓN (RUST + APERTURA AUTOMÁTICA) ---
  const handleExecuteTool = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);

    try {
      if (activeTool === "merge") {
        const savePath = await save({
          filters: [{ name: 'Documento PDF', extensions: ['pdf'] }],
          defaultPath: 'Documento_Unido.pdf'
        });

        if (!savePath) {
          setIsProcessing(false);
          return;
        }

        const filePaths = files.map(f => f.path);

        const resultado = await invoke("merge_pdfs", {
          filePaths: filePaths,
          outputPath: savePath
        });

        // ¡NUEVO! Abrimos el archivo generado con el visor predeterminado de Windows
        await openFile(savePath);

        // Vaciamos la cola de archivos y confirmamos
        setFiles([]);
        alert("¡Éxito! " + resultado);

      } else {
        alert("Esta herramienta estará disponible en la próxima actualización.");
      }
    } catch (error) {
      console.error("Error desde el backend de Rust:", error);
      alert("Ocurrió un error: " + error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- EVENTOS DRAG & DROP FRONTEND ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => file.type === "application/pdf" || file.name.endsWith(".pdf"));

    const newFiles = droppedFiles.map(f => ({
      id: Math.random().toString(36).substr(2, 9),
      name: f.name,
      path: "Arrastrado (Requiere Plugin nativo de Tauri)",
      size: (f.size / 1024 / 1024).toFixed(2) + " MB"
    }));

    setFiles(prev => [...prev, ...newFiles]);
  };

  const removeFile = (id) => {
    setFiles(files.filter(f => f.id !== id));
  };

  // --- TEXTOS E ICONOS ---
  const tools = {
    merge: {
      title: "Unir PDFs",
      desc: "Combina múltiples archivos PDF en un solo documento consolidado.",
      how: "Carga todos los archivos que quieras unir. El orden en la lista será el orden del documento final.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h7.5M8.25 17.25h7.5" />
        </svg>
      )
    },
    split: {
      title: "Dividir PDF",
      desc: "Extrae páginas específicas o divide un archivo grande en varios documentos pequeños.",
      how: "Próximamente disponible en la fase 2 del desarrollo.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0m-9.75 0h9.75" />
        </svg>
      )
    },
    organize: {
      title: "Organizar Páginas",
      desc: "Visualiza todas las páginas para reordenar, rotar o eliminar lo que no sirve.",
      how: "Próximamente disponible en la fase 3 del desarrollo.",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
        </svg>
      )
    }
  };

  return (
    <div className="flex h-screen w-screen bg-neutral-900 text-neutral-200 overflow-hidden font-sans">

      {/* SIDEBAR */}
      <aside className="w-72 bg-neutral-950 border-r border-neutral-800 flex flex-col shadow-xl z-20 shrink-0">
        <div className="p-8">
          <h1 className="text-2xl font-black tracking-tighter text-white italic">LIL-PDF</h1>
          <div className="h-1 w-8 bg-neutral-700 mt-2 rounded-full"></div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {Object.entries(tools).map(([id, tool]) => (
            <button
              key={id}
              onClick={() => { setActiveTool(id); setFiles([]); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${activeTool === id
                  ? "bg-neutral-800 text-white shadow-inner"
                  : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
                }`}
            >
              <span className={`${activeTool === id ? "text-white" : "text-neutral-600 group-hover:text-neutral-400"}`}>
                {tool.icon}
              </span>
              <span className="font-medium tracking-tight text-sm">{tool.title}</span>
            </button>
          ))}
        </nav>

        <div className="p-6">
          <div className="p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800/50 text-center">
            <p className="text-[10px] uppercase tracking-widest text-neutral-600 font-bold mb-2">Apoya el proyecto</p>
            <p className="text-xs text-neutral-400 leading-relaxed">Si te ahorré tiempo,<br />invitame un café ☕</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main
        className="flex-1 flex flex-col relative overflow-y-auto"
        onDragEnter={handleDragOver}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >

        {isDragging && (
          <div className="absolute inset-0 z-50 bg-neutral-900/90 backdrop-blur-sm border-4 border-dashed border-white/50 rounded-lg m-4 flex flex-col items-center justify-center transition-all">
            <svg className="w-24 h-24 text-white mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
            <p className="text-3xl font-bold text-white tracking-tight">¡Suéltalo aquí!</p>
          </div>
        )}

        <div className="p-10 max-w-5xl w-full mx-auto flex-1 flex flex-col min-h-0">
          <header className="mb-10 shrink-0">
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
                <span className="text-neutral-200 font-semibold not-italic">¿Cómo funciona? </span>
                {tools[activeTool].how}
              </p>
            </div>
          </header>

          {/* VISTA 1: DROPZONE GIGANTE */}
          {files.length === 0 && (
            <div className="flex-1 border-2 border-dashed border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center bg-neutral-900/50 hover:border-neutral-600 transition-all duration-300 group min-h-[300px]">
              <div className="text-center p-8 pointer-events-none">
                <div className="mb-6 transform group-hover:scale-110 transition-transform duration-500">
                  <svg className="mx-auto h-20 w-20 text-neutral-700 group-hover:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-neutral-200 tracking-tight">Suelta tus PDFs aquí</p>
                <p className="text-neutral-500 mt-3 max-w-xs mx-auto leading-relaxed">
                  Los archivos se procesan localmente. <br />
                  <span className="text-neutral-600 font-medium">Privacidad garantizada al 100%.</span>
                </p>
              </div>

              <div className="mt-4 flex gap-3 justify-center z-10">
                <button
                  onClick={handleSelectFiles}
                  className="bg-white text-black px-6 py-2.5 rounded-xl font-bold hover:bg-neutral-200 transition-all active:scale-95 shadow-lg text-sm"
                >
                  Seleccionar Archivos
                </button>
                <button
                  onClick={handleSelectFolder}
                  className="bg-neutral-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-neutral-700 transition-all active:scale-95 border border-neutral-700 text-sm"
                >
                  Cargar Carpeta
                </button>
              </div>
            </div>
          )}

          {/* VISTA 2: LISTA DE ARCHIVOS */}
          {files.length > 0 && (
            <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">Archivos en cola ({files.length})</h3>
                <button
                  onClick={handleSelectFiles}
                  className="text-sm font-medium text-neutral-400 hover:text-white transition-colors border border-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-800"
                >
                  + Agregar más archivos
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-xl hover:bg-neutral-800 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="p-2 bg-neutral-900 rounded-lg text-red-500 shrink-0">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                        </svg>
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-white truncate">{file.name}</p>
                        <p className="text-xs text-neutral-500 truncate" title={file.path}>{file.path}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(file.id)}
                      className="text-neutral-500 hover:text-red-400 p-2 hover:bg-red-400/10 rounded-lg transition-colors shrink-0"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-neutral-800 shrink-0">
                <button
                  onClick={handleExecuteTool}
                  disabled={isProcessing}
                  className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 ${isProcessing
                      ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
                      : "bg-white text-black hover:bg-neutral-200 active:scale-[0.98] shadow-xl"
                    }`}
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-neutral-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Procesando localmente...
                    </>
                  ) : (
                    "Ejecutar Herramienta"
                  )}
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}

export default App;