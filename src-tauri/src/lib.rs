// src-tauri/src/lib.rs

use lopdf::{Dictionary, Document, Object};
use std::collections::BTreeMap;

// Esta macro expone la función a nuestro frontend (React)
#[tauri::command]
async fn merge_pdfs(file_paths: Vec<String>, output_path: String) -> Result<String, String> {
    let mut max_id = 1;
    let mut paged_doc = Document::with_version("1.5");
    let mut pages_object_ids = vec![];
    let mut all_objects = BTreeMap::new();

    // 1. Recorremos cada ruta absoluta que nos envió React
    for path in file_paths {
        // Cargamos el archivo en memoria. Si no existe o está corrupto, devolvemos el error limpio.
        let mut doc =
            Document::load(&path).map_err(|e| format!("Error al cargar {}: {}", path, e))?;

        // 2. Renumeramos los punteros de memoria para evitar colisiones entre los PDFs
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        // 3. Extraemos las referencias a las páginas de este documento
        let doc_pages = doc.get_pages();
        for (_, object_id) in doc_pages {
            pages_object_ids.push(Object::Reference(object_id));
        }

        // 4. Acumulamos todos los objetos brutos en nuestro mapa de memoria principal
        all_objects.extend(doc.objects);
    }

    // 5. Construimos el "Catálogo" (El índice interno que le dice a los lectores PDF dónde están las páginas)
    let mut catalog = Dictionary::new();
    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    pages_dict.set("Count", Object::Integer(pages_object_ids.len() as i64));
    pages_dict.set("Kids", Object::Array(pages_object_ids));

    let pages_id = (max_id, 0);
    all_objects.insert(pages_id, Object::Dictionary(pages_dict));

    catalog.set("Type", Object::Name(b"Catalog".to_vec()));
    catalog.set("Pages", Object::Reference(pages_id));

    let catalog_id = (max_id + 1, 0);
    all_objects.insert(catalog_id, Object::Dictionary(catalog));

    // 6. Ensamblamos el documento final en la memoria de Rust
    paged_doc.objects = all_objects;
    paged_doc.trailer.set("Root", Object::Reference(catalog_id));
    paged_doc.max_id = paged_doc.objects.keys().map(|k| k.0).max().unwrap_or(0);

    // 7. Escribimos el archivo final en el disco duro del usuario
    paged_doc
        .save(&output_path)
        .map_err(|e| format!("Error al guardar archivo final: {}", e))?;

    // Le avisamos a React que todo salió perfecto
    Ok(format!("PDF guardado exitosamente en: {}", output_path))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // ¡CRUCIAL! Registramos nuestro nuevo comando aquí
        .invoke_handler(tauri::generate_handler![merge_pdfs])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
