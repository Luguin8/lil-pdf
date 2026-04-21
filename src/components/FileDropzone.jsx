// src/components/FileDropzone.jsx
import { open as openDialog } from "@tauri-apps/plugin-dialog";

/**
 * Zona de arrastre/selección de archivos reutilizable.
 * Props:
 *   onFilesSelected(files[]) - callback con array de {id, name, path}
 *   multiple (bool) - permitir múltiples archivos
 *   acceptFolders (bool) - mostrar botón de carpeta
 *   label (string) - texto principal opcional
 *   sublabel (string) - texto secundario opcional
 */
export default function FileDropzone({
  onFilesSelected,
  multiple = true,
  acceptFolders = false,
  label = "Suelta tus PDFs aquí",
  sublabel = null,
}) {
  const handleSelectFiles = async () => {
    try {
      const selectedPaths = await openDialog({
        multiple,
        filters: [{ name: "Documentos PDF", extensions: ["pdf"] }],
      });

      if (!selectedPaths) return;

      const paths = Array.isArray(selectedPaths) ? selectedPaths : [selectedPaths];
      const newFiles = paths.map((path) => {
        const fileName = path.split(/[\\/]/).pop();
        return {
          id: Math.random().toString(36).substr(2, 9),
          name: fileName,
          path: path,
        };
      });
      onFilesSelected(newFiles);
    } catch (error) {
      console.error("Error al abrir diálogo:", error);
    }
  };

  const handleSelectFolder = async () => {
    try {
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
        };
        onFilesSelected([newFile]);
      }
    } catch (error) {
      console.error("Error al abrir diálogo:", error);
    }
  };

  return (
    <div className="flex-1 border-2 border-dashed border-neutral-800 rounded-[2.5rem] flex flex-col items-center justify-center bg-neutral-900/50 hover:border-neutral-600 transition-all duration-300 group min-h-[300px]">
      <div className="text-center p-8 pointer-events-none">
        <div className="mb-6 transform group-hover:scale-110 transition-transform duration-500">
          <svg
            className="mx-auto h-20 w-20 text-neutral-700 group-hover:text-neutral-500"
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
        </div>
        <p className="text-2xl font-bold text-neutral-200 tracking-tight">
          {label}
        </p>
        <p className="text-neutral-500 mt-3 max-w-xs mx-auto leading-relaxed">
          {sublabel || (
            <>
              Los archivos se procesan localmente. <br />
              <span className="text-neutral-600 font-medium">
                Privacidad garantizada al 100%.
              </span>
            </>
          )}
        </p>
      </div>

      <div className="mt-4 flex gap-3 justify-center z-10">
        <button
          onClick={handleSelectFiles}
          className="bg-white text-black px-6 py-2.5 rounded-xl font-bold hover:bg-neutral-200 transition-all active:scale-95 shadow-lg text-sm cursor-pointer"
        >
          {multiple ? "Seleccionar Archivos" : "Seleccionar Archivo"}
        </button>
        {acceptFolders && (
          <button
            onClick={handleSelectFolder}
            className="bg-neutral-800 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-neutral-700 transition-all active:scale-95 border border-neutral-700 text-sm cursor-pointer"
          >
            Cargar Carpeta
          </button>
        )}
      </div>
    </div>
  );
}
