// src/components/SplitTool.jsx
import { useState, useEffect } from "react";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { useToast } from "./Toast";
import FileDropzone from "./FileDropzone";

export default function SplitTool({ droppedPaths, onDroppingHandled }) {
  const [file, setFile] = useState(null); // { name, path }
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const toast = useToast();

  // Modo: "range" o "every"
  const [mode, setMode] = useState("range");

  // Inputs para modo rango
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);

  // Input para modo cada-N
  const [pagesPerFile, setPagesPerFile] = useState(1);

  // Procesar archivos soltados desde escritorio
  useEffect(() => {
    if (droppedPaths && droppedPaths.length > 0) {
      loadFile(droppedPaths[0]);
      onDroppingHandled();
    }
  }, [droppedPaths, onDroppingHandled]);

  const loadFile = async (filePath) => {
    setIsLoading(true);
    try {
      const count = await invoke("get_pdf_page_count", { filePath });
      const fileName = filePath.split(/[\\/]/).pop();
      setFile({ name: fileName, path: filePath });
      setPageCount(count);
      setStartPage(1);
      setEndPage(count);
      setPagesPerFile(Math.max(1, Math.ceil(count / 2)));
    } catch (error) {
      toast.error("Error al cargar PDF: " + error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelected = (newFiles) => {
    if (newFiles.length > 0) {
      loadFile(newFiles[0].path);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPageCount(0);
  };

  // --- Validaciones ---
  const isRangeValid =
    startPage >= 1 &&
    endPage <= pageCount &&
    startPage <= endPage &&
    Number.isInteger(startPage) &&
    Number.isInteger(endPage);

  const isEveryValid =
    pagesPerFile >= 1 &&
    pagesPerFile <= pageCount &&
    Number.isInteger(pagesPerFile);

  const totalOutputFiles = isEveryValid
    ? Math.ceil(pageCount / pagesPerFile)
    : 0;

  // --- Ejecutar Split: Rango ---
  const handleExtractRange = async () => {
    if (!isRangeValid) return;
    setIsProcessing(true);
    try {
      const savePath = await save({
        filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
        defaultPath: `${file.name.replace(/\.pdf$/i, "")}_paginas_${startPage}-${endPage}.pdf`,
      });
      if (!savePath) {
        setIsProcessing(false);
        return;
      }
      await invoke("extract_pdf_pages", {
        filePath: file.path,
        startPage,
        endPage,
        outputPath: savePath,
      });
      const openResult = await invoke("open_result_file", { filePath: savePath });
      toast.success(openResult);
    } catch (error) {
      toast.error("Error: " + error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Ejecutar Split: Cada N ---
  const handleSplitEveryN = async () => {
    if (!isEveryValid) return;
    setIsProcessing(true);
    try {
      const outputFolder = await openDialog({
        directory: true,
        multiple: false,
        title: "Elegí la carpeta donde guardar los archivos",
      });
      if (!outputFolder) {
        setIsProcessing(false);
        return;
      }
      const createdFiles = await invoke("split_pdf_every_n", {
        filePath: file.path,
        pagesPerFile,
        outputFolder,
      });
      toast.success(
        `¡Listo! Se crearon ${createdFiles.length} archivo${createdFiles.length !== 1 ? "s" : ""} en la carpeta seleccionada.`
      );
    } catch (error) {
      toast.error("Error: " + error);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Vista vacía ---
  if (!file) {
    return (
      <FileDropzone
        onFilesSelected={handleFileSelected}
        multiple={false}
        acceptFolders={false}
        label="Seleccioná un PDF para dividir"
        sublabel="Podés extraer un rango de páginas o dividir el archivo cada N páginas."
      />
    );
  }

  // --- Vista con archivo cargado ---
  return (
    <div className="flex-1 flex flex-col anim-slide-up">
      {/* Info del archivo cargado */}
      <div className="flex items-center justify-between p-4 bg-neutral-800/50 border border-neutral-700/50 rounded-xl mb-6">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="p-2.5 bg-neutral-900 rounded-lg text-red-500 shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
            </svg>
          </div>
          <div className="truncate">
            <p className="text-sm font-semibold text-white truncate">{file.name}</p>
            <p className="text-xs text-neutral-400">{pageCount} página{pageCount !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="text-sm text-neutral-400 hover:text-white transition-colors border border-neutral-700 px-3 py-1.5 rounded-lg hover:bg-neutral-800 cursor-pointer"
        >
          Cambiar archivo
        </button>
      </div>

      {/* Toggle de modo */}
      <div className="mode-toggle mb-6">
        <button
          className={`mode-toggle-btn ${mode === "range" ? "active" : ""}`}
          onClick={() => setMode("range")}
        >
          📄 Extraer rango de páginas
        </button>
        <button
          className={`mode-toggle-btn ${mode === "every" ? "active" : ""}`}
          onClick={() => setMode("every")}
        >
          📑 Dividir cada N páginas
        </button>
      </div>

      {/* Contenido según modo */}
      <div className="flex-1">
        {mode === "range" ? (
          <div className="anim-fade-in">
            <p className="text-sm text-neutral-400 mb-6">
              Elegí qué páginas querés extraer. Se creará un nuevo PDF solo con esas páginas.
            </p>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex flex-col items-center gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Desde
                </label>
                <input
                  type="number"
                  className="num-input"
                  value={startPage}
                  min={1}
                  max={pageCount}
                  onChange={(e) => setStartPage(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="text-neutral-600 mt-5 text-xl">→</div>

              <div className="flex flex-col items-center gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Hasta
                </label>
                <input
                  type="number"
                  className="num-input"
                  value={endPage}
                  min={1}
                  max={pageCount}
                  onChange={(e) => setEndPage(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="flex-1 ml-4 p-3 bg-neutral-800/30 border border-neutral-800 rounded-xl">
                <p className="text-xs text-neutral-500">
                  {isRangeValid ? (
                    <>
                      Se extraerán <span className="text-white font-semibold">{endPage - startPage + 1}</span> página{endPage - startPage + 1 !== 1 ? "s" : ""} de {pageCount}
                    </>
                  ) : (
                    <span className="text-red-400">Rango inválido</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="anim-fade-in">
            <p className="text-sm text-neutral-400 mb-6">
              El PDF se dividirá en archivos más pequeños, cada uno con la cantidad de páginas que elijas.
            </p>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex flex-col items-center gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  Páginas por archivo
                </label>
                <input
                  type="number"
                  className="num-input"
                  value={pagesPerFile}
                  min={1}
                  max={pageCount}
                  onChange={(e) => setPagesPerFile(parseInt(e.target.value) || 1)}
                />
              </div>

              <div className="flex-1 ml-4 p-3 bg-neutral-800/30 border border-neutral-800 rounded-xl">
                <p className="text-xs text-neutral-500">
                  {isEveryValid ? (
                    <>
                      Se crearán <span className="text-white font-semibold">{totalOutputFiles}</span> archivo{totalOutputFiles !== 1 ? "s" : ""}
                    </>
                  ) : (
                    <span className="text-red-400">Valor inválido</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botón ejecutar */}
      <div className="mt-6 pt-6 border-t border-neutral-800 shrink-0">
        <button
          onClick={mode === "range" ? handleExtractRange : handleSplitEveryN}
          disabled={isProcessing || (mode === "range" ? !isRangeValid : !isEveryValid)}
          className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3 cursor-pointer ${
            isProcessing || (mode === "range" ? !isRangeValid : !isEveryValid)
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
              Procesando...
            </>
          ) : mode === "range" ? (
            `Extraer páginas ${startPage}–${endPage}`
          ) : (
            `Dividir en ${totalOutputFiles} archivo${totalOutputFiles !== 1 ? "s" : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
