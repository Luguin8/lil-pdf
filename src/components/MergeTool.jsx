// src/components/MergeTool.jsx
import { useState, useEffect } from "react";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "./Toast";
import FileDropzone from "./FileDropzone";

export default function MergeTool({ droppedPaths, onDroppingHandled }) {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const toast = useToast();

  // Drag-and-drop reorder state
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Procesar archivos soltados desde el escritorio (Tauri native D&D)
  useEffect(() => {
    if (droppedPaths && droppedPaths.length > 0) {
      const newFiles = droppedPaths.map((path) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: path.split(/[\\/]/).pop(),
        path,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
      onDroppingHandled();
    }
  }, [droppedPaths, onDroppingHandled]);

  const handleFilesSelected = (newFiles) => {
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleAddMore = async () => {
    try {
      const selectedPaths = await openDialog({
        multiple: true,
        filters: [{ name: "Documentos PDF", extensions: ["pdf"] }],
      });
      if (!selectedPaths) return;
      const paths = Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths];
      const newFiles = paths.map((path) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: path.split(/[\\/]/).pop(),
        path,
      }));
      setFiles((prev) => [...prev, ...newFiles]);
    } catch (error) {
      console.error("Error al abrir diálogo:", error);
    }
  };

  const removeFile = (id) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  // --- Reordenamiento mediante flechas ---
  const moveUp = (index) => {
    if (index === 0) return;
    setFiles((prev) => {
      const newFiles = [...prev];
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
      return newFiles;
    });
  };

  const moveDown = (index) => {
    if (index === files.length - 1) return;
    setFiles((prev) => {
      const newFiles = [...prev];
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      return newFiles;
    });
  };

  // --- Ejecutar merge ---
  const handleExecute = async () => {
    if (files.length < 2) {
      toast.error("Necesitás al menos 2 archivos para unir.");
      return;
    }
    setIsProcessing(true);
    try {
      const savePath = await save({
        filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
        defaultPath: "Documento_Unido.pdf",
      });
      if (!savePath) {
        setIsProcessing(false);
        return;
      }
      const filePaths = files.map((f) => f.path);
      await invoke("merge_pdfs", {
        filePaths,
        outputPath: savePath,
      });
      const openResult = await invoke("open_result_file", { filePath: savePath });
      setFiles([]);
      toast.success(openResult);
    } catch (error) {
      console.error("Error desde Rust:", error);
      toast.error("Error: " + error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Vista vacía ---
  if (files.length === 0) {
    return (
      <FileDropzone
        onFilesSelected={handleFilesSelected}
        multiple={true}
        acceptFolders={true}
      />
    );
  }

  // --- Vista con archivos ---
  return (
    <div className="flex-1 flex flex-col anim-slide-up">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-white">
          Archivos en cola ({files.length})
        </h3>
        <button
          onClick={handleAddMore}
          className="text-sm font-medium text-neutral-400 hover:text-white transition-colors border border-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-800 cursor-pointer"
        >
          + Agregar más
        </button>
      </div>

      <p className="text-xs text-neutral-500 mb-3 flex items-center gap-1.5">
        <svg className="w-3.5 h-3.5 text-neutral-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        Arrastrá los archivos con el ícono ⠿ para cambiar el orden del documento final.
      </p>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {files.map((file, index) => (
          <div
            key={file.id}
            className={`file-item flex items-center justify-between p-3.5 bg-neutral-800/50 border border-neutral-700/50 rounded-xl hover:bg-neutral-800 transition-colors`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex flex-col gap-1 pr-2 border-r border-neutral-700/50">
                <button
                  className="text-neutral-500 hover:text-white p-0.5 rounded-sm hover:bg-neutral-700 transition"
                  onClick={() => moveUp(index)}
                  disabled={index === 0}
                  title="Subir"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
                  </svg>
                </button>
                <button
                  className="text-neutral-500 hover:text-white p-0.5 rounded-sm hover:bg-neutral-700 transition"
                  onClick={() => moveDown(index)}
                  disabled={index === files.length - 1}
                  title="Bajar"
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
              </div>

              <div className="p-2 bg-neutral-900 rounded-lg text-red-500 shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                </svg>
              </div>
              <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{file.name}</p>
                <p className="text-[11px] text-neutral-500 truncate" title={file.path}>{file.path}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-bold text-neutral-600 bg-neutral-900 px-2 py-0.5 rounded-md">
                #{index + 1}
              </span>
              <button
                onClick={() => removeFile(file.id)}
                className="text-neutral-500 hover:text-red-400 p-1.5 hover:bg-red-400/10 rounded-lg transition-colors cursor-pointer"
                title="Quitar archivo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-neutral-800 shrink-0">
        <button
          onClick={handleExecute}
          disabled={isProcessing || files.length < 2}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 cursor-pointer ${
            isProcessing || files.length < 2
              ? "bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700"
              : "bg-white text-black hover:bg-neutral-200 active:scale-[0.98] shadow-xl"
          }`}
        >
          {isProcessing ? (
            <>
              <svg className="anim-spin h-5 w-5 text-neutral-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Uniendo archivos...
            </>
          ) : (
            `Unir ${files.length} archivo${files.length !== 1 ? "s" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
