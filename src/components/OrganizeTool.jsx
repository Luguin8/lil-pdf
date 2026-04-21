// src/components/OrganizeTool.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { openPath } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import * as pdfjsLib from "pdfjs-dist";
import { useToast } from "./Toast";
import FileDropzone from "./FileDropzone";
import PagePreviewModal from "./PagePreviewModal";

// Configurar worker de pdf.js para Vite
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// Escalas de renderizado
const THUMB_SCALE = 0.4;
const PREVIEW_SCALE = 1.8;

export default function OrganizeTool({ droppedPaths, onDroppingHandled }) {
  const [file, setFile] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const toast = useToast();

  // pdf.js document ref
  const pdfDocRef = useRef(null);

  // Thumbnails cache: { [pageNum]: dataURL }
  const [thumbnails, setThumbnails] = useState({});

  // Preview images cache (larger): { [pageNum]: dataURL }
  const [previews, setPreviews] = useState({});

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalIndex, setModalIndex] = useState(0);

  // --- Page state (the core editable state) ---
  // Array de { originalPageNum, rotation, deleted }
  const [pageState, setPageState] = useState([]);

  // --- Undo/Redo ---
  const [history, setHistory] = useState([]);
  const [future, setFuture] = useState([]);

  // Drag state for reordering
  const [dragIndex, setDragIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Procesar archivos soltados desde escritorio
  useEffect(() => {
    if (droppedPaths && droppedPaths.length > 0) {
      loadFile(droppedPaths[0]);
      onDroppingHandled();
    }
  }, [droppedPaths, onDroppingHandled]);

  // --- Cargar archivo PDF ---
  const loadFile = async (filePath) => {
    setIsLoading(true);
    setThumbnails({});
    setPreviews({});
    setHistory([]);
    setFuture([]);

    try {
      // Obtener page count
      const count = await invoke("get_pdf_page_count", { filePath });
      const fileName = filePath.split(/[\\/]/).pop();
      setFile({ name: fileName, path: filePath });
      setPageCount(count);

      // Inicializar estado de páginas
      const initialState = Array.from({ length: count }, (_, i) => ({
        originalPageNum: i + 1,
        rotation: 0,
        deleted: false,
      }));
      setPageState(initialState);

      // Leer bytes del PDF para pdf.js
      const base64Data = await invoke("read_pdf_file", { filePath });
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Cargar en pdf.js
      const pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
      pdfDocRef.current = pdfDoc;

      // Renderizar thumbnails progresivamente
      renderThumbnailsBatch(pdfDoc, count, 1);
    } catch (error) {
      toast.error("Error al cargar PDF: " + error);
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar thumbnails en lotes para no bloquear la UI
  const renderThumbnailsBatch = async (pdfDoc, total, startFrom) => {
    const BATCH_SIZE = 8;
    const end = Math.min(startFrom + BATCH_SIZE - 1, total);

    for (let i = startFrom; i <= end; i++) {
      try {
        const dataUrl = await renderPageToImage(pdfDoc, i, THUMB_SCALE, 0.65);
        setThumbnails((prev) => ({ ...prev, [i]: dataUrl }));
      } catch (err) {
        console.error(`Error renderizando página ${i}:`, err);
      }
    }

    // Continuar con el siguiente lote
    if (end < total) {
      requestAnimationFrame(() => renderThumbnailsBatch(pdfDoc, total, end + 1));
    }
  };

  // Renderizar una página a imagen
  const renderPageToImage = async (pdfDoc, pageNum, scale, quality = 0.75) => {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toDataURL("image/jpeg", quality);
  };

  // --- Acciones con undo/redo ---
  const saveToHistory = useCallback(() => {
    setHistory((prev) => [...prev, pageState]);
    setFuture([]);
  }, [pageState]);

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture((f) => [...f, pageState]);
    setPageState(prev);
    setHistory((h) => h.slice(0, -1));
  };

  const redo = () => {
    if (future.length === 0) return;
    const next = future[future.length - 1];
    setHistory((h) => [...h, pageState]);
    setPageState(next);
    setFuture((f) => f.slice(0, -1));
  };

  // Rotar página 90° clockwise
  const rotatePage = (index) => {
    saveToHistory();
    setPageState((prev) => {
      const newState = [...prev];
      newState[index] = {
        ...newState[index],
        rotation: (newState[index].rotation + 90) % 360,
      };
      return newState;
    });
  };

  // Toggle eliminar/restaurar página
  const toggleDeletePage = (index) => {
    saveToHistory();
    setPageState((prev) => {
      const newState = [...prev];
      newState[index] = {
        ...newState[index],
        deleted: !newState[index].deleted,
      };
      return newState;
    });
  };

  // --- Drag & drop reorder para thumbnails ---
  const handleDragStart = (e, index) => {
    setDragIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragIndex !== null && index !== dragIndex) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      handleDragEnd();
      return;
    }
    saveToHistory();
    const newState = [...pageState];
    const [moved] = newState.splice(dragIndex, 1);
    newState.splice(dropIndex, 0, moved);
    setPageState(newState);
    handleDragEnd();
  };

  // --- Abrir modal de preview ---
  const openPreview = async (index) => {
    const page = pageState[index];
    const pageNum = page.originalPageNum;

    // Si no tenemos el preview en alta resolución, renderizarlo
    if (!previews[pageNum] && pdfDocRef.current) {
      try {
        const dataUrl = await renderPageToImage(
          pdfDocRef.current,
          pageNum,
          PREVIEW_SCALE,
          0.85
        );
        setPreviews((prev) => ({ ...prev, [pageNum]: dataUrl }));
      } catch (err) {
        console.error("Error renderizando preview:", err);
      }
    }

    setModalIndex(index);
    setModalOpen(true);
  };

  const handleModalNavigate = async (newIndex) => {
    if (newIndex < 0 || newIndex >= pageState.length) return;

    const page = pageState[newIndex];
    const pageNum = page.originalPageNum;

    // Pre-renderizar si no existe
    if (!previews[pageNum] && pdfDocRef.current) {
      try {
        const dataUrl = await renderPageToImage(
          pdfDocRef.current,
          pageNum,
          PREVIEW_SCALE,
          0.85
        );
        setPreviews((prev) => ({ ...prev, [pageNum]: dataUrl }));
      } catch (err) {
        console.error("Error renderizando preview:", err);
      }
    }

    setModalIndex(newIndex);
  };

  // --- Guardar PDF organizado ---
  const handleSave = async () => {
    const activePagesInOrder = pageState.filter((p) => !p.deleted);

    if (activePagesInOrder.length === 0) {
      toast.error("No hay páginas para guardar. Restaurá al menos una.");
      return;
    }

    setIsProcessing(true);
    try {
      const savePath = await save({
        filters: [{ name: "Documento PDF", extensions: ["pdf"] }],
        defaultPath: `${file.name.replace(/\.pdf$/i, "")}_organizado.pdf`,
      });

      if (!savePath) {
        setIsProcessing(false);
        return;
      }

      const pageOrder = activePagesInOrder.map((p) => p.originalPageNum);
      const rotations = {};
      for (const p of activePagesInOrder) {
        if (p.rotation !== 0) {
          rotations[p.originalPageNum] = p.rotation;
        }
      }

      await invoke("save_organized_pdf", {
        filePath: file.path,
        pageOrder,
        rotations,
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

  const handleReset = () => {
    setFile(null);
    setPageCount(0);
    setPageState([]);
    setThumbnails({});
    setPreviews({});
    setHistory([]);
    setFuture([]);
    pdfDocRef.current = null;
  };

  // Contar activas y eliminadas
  const activeCount = pageState.filter((p) => !p.deleted).length;
  const deletedCount = pageState.filter((p) => p.deleted).length;

  // Preparar array de previews para el modal
  const modalPages = pageState.map((p) => previews[p.originalPageNum] || thumbnails[p.originalPageNum] || null);

  // --- Vista vacía ---
  if (!file) {
    return (
      <FileDropzone
        onFilesSelected={(files) => files.length > 0 && loadFile(files[0].path)}
        multiple={false}
        acceptFolders={false}
        label="Seleccioná un PDF para organizar"
        sublabel="Podés reordenar, rotar y eliminar páginas visualmente."
      />
    );
  }

  // --- Vista de carga ---
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <svg className="anim-spin h-10 w-10 text-neutral-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-neutral-400 font-medium">Cargando páginas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 anim-slide-up">
      {/* Toolbar con undo/redo/save */}
      <div className="organize-toolbar shrink-0">
        <button
          className="toolbar-btn"
          onClick={undo}
          disabled={history.length === 0}
          title="Deshacer (Ctrl+Z)"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3" />
          </svg>
          Deshacer
        </button>

        <button
          className="toolbar-btn"
          onClick={redo}
          disabled={future.length === 0}
          title="Rehacer (Ctrl+Y)"
        >
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 0 0 0 12h3" />
          </svg>
          Rehacer
        </button>

        <div className="toolbar-separator" />

        <button
          className="toolbar-btn"
          onClick={handleReset}
          title="Cambiar archivo"
        >
          Cambiar archivo
        </button>

        <span className="toolbar-info">
          {activeCount} página{activeCount !== 1 ? "s" : ""}
          {deletedCount > 0 && (
            <span className="text-red-400 ml-1">({deletedCount} eliminada{deletedCount !== 1 ? "s" : ""})</span>
          )}
        </span>

        <button
          className="toolbar-btn primary"
          onClick={handleSave}
          disabled={isProcessing || activeCount === 0}
        >
          {isProcessing ? (
            <>
              <svg className="anim-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Guardando...
            </>
          ) : (
            <>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Guardar como...
            </>
          )}
        </button>
      </div>

      {/* Tip */}
      <p className="text-xs text-neutral-500 mb-3 flex items-center gap-1.5 shrink-0">
        <svg className="w-3.5 h-3.5 text-neutral-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        Arrastrá las páginas para reordenarlas. Hacé click para verlas en grande.
      </p>

      {/* Grid de thumbnails */}
      <div className="flex-1 overflow-y-auto pr-1">
        <div className="thumbnail-grid">
          {pageState.map((page, index) => (
            <div
              key={`${page.originalPageNum}-${index}`}
              draggable="true"
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, index)}
              className={`thumbnail-card ${
                dragIndex === index ? "dragging" : ""
              } ${
                dragOverIndex === index ? "drag-over" : ""
              } ${
                page.deleted ? "deleted" : ""
              }`}
            >
              <div className="absolute top-1.5 left-1.5 p-1 bg-black/60 rounded cursor-grab z-10 hover:bg-black/80 text-white backdrop-blur-sm shadow-sm" title="Arrastrar para mover">
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                  <circle cx="5" cy="3" r="1.5" />
                  <circle cx="11" cy="3" r="1.5" />
                  <circle cx="5" cy="8" r="1.5" />
                  <circle cx="11" cy="8" r="1.5" />
                  <circle cx="5" cy="13" r="1.5" />
                  <circle cx="11" cy="13" r="1.5" />
                </svg>
              </div>

              {/* Imagen thumbnail */}
              {thumbnails[page.originalPageNum] ? (
                <img
                  src={thumbnails[page.originalPageNum]}
                  alt={`Página ${page.originalPageNum}`}
                  className="thumbnail-img"
                  style={{
                    transform: `rotate(${page.rotation}deg)`,
                    transition: "transform 0.3s ease",
                  }}
                  draggable={false}
                />
              ) : (
                <div className="thumbnail-skeleton" />
              )}

              {/* Botones de acción (hover) */}
              <div className="thumbnail-actions">
                <button
                  className="thumbnail-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    !page.deleted && openPreview(index);
                  }}
                  title="Vista Previa"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607ZM10.5 7.5v6m3-3h-6" />
                  </svg>
                </button>
                <button
                  className="thumbnail-action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    rotatePage(index);
                  }}
                  title="Rotar 90°"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
                  </svg>
                </button>
                <button
                  className={`thumbnail-action-btn ${page.deleted ? "" : "delete"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDeletePage(index);
                  }}
                  title={page.deleted ? "Restaurar página" : "Eliminar página"}
                >
                  {page.deleted ? (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Footer: número de página + badge de rotación */}
              <div className="thumbnail-footer">
                <span>Pág. {page.originalPageNum}</span>
                {page.rotation !== 0 && (
                  <span className="thumbnail-rotation-badge">{page.rotation}°</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de preview */}
      {modalOpen && (
        <PagePreviewModal
          pages={modalPages}
          currentIndex={modalIndex}
          onClose={() => setModalOpen(false)}
          onNavigate={handleModalNavigate}
        />
      )}
    </div>
  );
}
