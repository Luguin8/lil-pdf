// src/components/PagePreviewModal.jsx
import { useEffect, useCallback } from "react";

/**
 * Modal de vista previa de página PDF.
 * Props:
 *   pages[] - array de data URLs (imágenes renderizadas)
 *   currentIndex - índice de la página actual (0-based)
 *   onClose() - cerrar modal
 *   onNavigate(newIndex) - navegar a otra página
 */
export default function PagePreviewModal({
  pages,
  currentIndex,
  onClose,
  onNavigate,
}) {
  const totalPages = pages.length;

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === "ArrowRight" && currentIndex < totalPages - 1) {
        onNavigate(currentIndex + 1);
      }
    },
    [currentIndex, totalPages, onClose, onNavigate]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Click en el backdrop cierra el modal
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        {/* Botón cerrar */}
        <button className="modal-close-btn" onClick={onClose} title="Cerrar (Esc)">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Flecha izquierda */}
        <button
          className="modal-nav-btn left"
          onClick={() => onNavigate(currentIndex - 1)}
          disabled={currentIndex <= 0}
          title="Página anterior (←)"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </button>

        {/* Imagen de la página */}
        {pages[currentIndex] ? (
          <img
            src={pages[currentIndex]}
            alt={`Página ${currentIndex + 1}`}
            className="modal-image"
          />
        ) : (
          <div className="flex items-center justify-center" style={{ width: 600, height: 800 }}>
            <div className="thumbnail-skeleton" style={{ width: 500, height: 700 }} />
          </div>
        )}

        {/* Flecha derecha */}
        <button
          className="modal-nav-btn right"
          onClick={() => onNavigate(currentIndex + 1)}
          disabled={currentIndex >= totalPages - 1}
          title="Página siguiente (→)"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Indicador de página */}
        <p className="modal-page-indicator">
          Página {currentIndex + 1} de {totalPages}
        </p>
      </div>
    </div>
  );
}
