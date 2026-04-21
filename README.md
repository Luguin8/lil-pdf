# LIL-PDF 🚀

> **Una herramienta de escritorio ultra liviana, rápida y local para la manipulación avanzada de archivos PDF.**

LIL-PDF es una aplicación multiplataforma construida con una arquitectura *Local-first*. Su objetivo principal es ofrecer las herramientas esenciales que los usuarios necesitan para trabajar con PDFs (Unir, Dividir y Organizar), pero sin el peso, la lentitud o los riesgos de privacidad de las alternativas tradicionales basadas en Chromium pesado o en la nube.

---

## 🛠 Arquitectura y Tecnologías

El proyecto fue diseñado bajo una estricta filosofía de "Cero dependencias innecesarias", priorizando el rendimiento puro y el bajo consumo de recursos en ordenadores de cualquier gama.

### Backend (Rust / Tauri v2)
- **Tauri v2:** Encargado de la ventana nativa y el acceso seguro al sistema de archivos (File System). Reemplaza totalmente el peso de un motor de Node.js u Electron.
- **Crate `lopdf`:** Manipulación directa de los diccionarios, streams y árboles de referencias (Parent nodes) de los PDFs a nivel binario. No requiere librerías pesadas en C/C++ vinculadas.
- **Crate `opener`:** Integración profunda con los sistemas operativos (Windows/MacOS/Linux) para abrir rutas de salida tras las ejecuciones saltándose restricciones ineficientes del bridge.
- **Crate `base64`:** Transformación ultrarrápida del contenido leído a memoria RAM para inyectar buffers a la vista.

### Frontend (React / Vite)
- **React.js Modular:** UI segmentada por flujos independientes (`MergeTool`, `SplitTool`, `OrganizeTool`).
- **Mozilla `pdf.js` (`pdfjs-dist`):** Implementado mediante Service Workers ligeros para parsear en Canvas los thumbnails y hojas completas *lazy-loaded* progresivamente, evitando saturar la tarjeta gráfica al leer libros de 1000+ páginas.
- **Drag-and-Drop Nativo:** HTML5 Drag con un diseño anti-fricciones (usando handles de agarre específicos) ensamblado en paralelo con `Tauri.onDragDropEvent` para la ingesta externa nativa desde el escritorio corporativo.
- **Vanilla CSS Animado + TailwindCSS:** En un esfuerzo por recortar KB, se desestimó `tailwindcss-animate` o `Framer Motion` en favor de escribir @keyframes y transitions 100% nativas en un archivo maestro.

---

## ✨ Features Principales

### 1. 🗂️ Unir Archivos PDF (Merge)
Permite arrastrar múltiples documentos al panel, reordenar su prioridad y salida mediante Drag and Drop en una lista virtualizada, validando la concatenación bajo un árbol de Paginación reparado atómicamente en Rust, asegurando que los visores estrictos (como Adobe Acrobat) no rompan el documento unido.

### 2. ✂️ Dividir PDFs (Split)
- **Modo "Extracción de Rango":** Indicando `Desde` y `Hasta`, recorta una tajada del original limpiamente sin adulterar compresiones.
- **Modo "Cada X Páginas":** Dividir dinámicamente un documento gigantesco partiéndolo en tomos matemáticamente iguales e inyectándolos en un directorio en milisegundos.

### 3. 🧩 Organización Visual de Páginas (Organize)
Un Canvas fotográfico del PDF completo:
- Lector de lotes progresivos (para no congelar ordenadores lentos).
- Botón **Rotar 90°** página por página.
- Botón **Omitir/Eliminar** tachando una página de la salida final.
- **Reordenamiento Visual (D&D):** Mover cada miniatura manualmente a donde encaje mejor vía grip handle superior.
- **Lupa Previsualizadora:** Lanza un Web-Modal instantáneo sobre la página sin demoras.
- ♻️ **Historial Undo/Redo incorporado** en memoria reactiva, salvando estados de matriz para perdonar errores del usuario.

### 4. 🔔 Toast Custom Native UI
Reemplazo total de los odiosos `alert` imperativos de los OS antiguos por una capa contextual (Notificaciones Success, Error e Info) inyectada en un Providers nativo de la app con animaciones keyframes lisas.

---

## 📥 Descarga la App
> LilPDF está compilado de manera portátil sin librerías fantasma de fondo pesando lo mínimo posible. Es de uso libre.

[![Descargar para Windows](https://img.shields.io/badge/Windows-Descargar_Setup_v1.0.1-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/Luguin8/lil-pdf/releases/latest)

1. Clickea sobre el botón o dirígete a la pestaña **[Releases](https://github.com/Luguin8/lil-pdf/releases)**.
2. Descarga el instalador `.exe` o `Setup`.
3. ¡Disfruta! Recibirás notificaciones si libero actualizaciones nuevas directamente desde la interfaz.

---

> Hecha con ☕ por [Martín Lugo](https://cafecito.app/lugomartin) | Contacto: `lugoamartin@gmail.com`
