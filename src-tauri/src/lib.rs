// src-tauri/src/lib.rs

use base64::{engine::general_purpose, Engine as _};
use lopdf::{Dictionary, Document, Object, ObjectId};
use std::collections::BTreeMap;
use std::path::Path;

// ============================================================
// UTILIDAD: Obtener la cantidad de páginas de un PDF
// ============================================================
#[tauri::command]
async fn get_pdf_page_count(file_path: String) -> Result<u32, String> {
    let doc = Document::load(&file_path)
        .map_err(|e| format!("Error al cargar {}: {}", file_path, e))?;
    Ok(doc.get_pages().len() as u32)
}

// ============================================================
// UTILIDAD: Leer un PDF y devolver bytes en base64 para pdf.js
// ============================================================
#[tauri::command]
async fn read_pdf_file(file_path: String) -> Result<String, String> {
    let bytes = std::fs::read(&file_path)
        .map_err(|e| format!("Error al leer archivo {}: {}", file_path, e))?;
    Ok(general_purpose::STANDARD.encode(&bytes))
}

// ============================================================
// MERGE: Unir múltiples PDFs en uno solo
// ============================================================
#[tauri::command]
async fn merge_pdfs(file_paths: Vec<String>, output_path: String) -> Result<String, String> {
    if file_paths.len() < 2 {
        return Err("Se necesitan al menos 2 archivos para unir.".to_string());
    }

    let mut max_id = 1;
    let mut paged_doc = Document::with_version("1.5");
    let mut pages_object_ids: Vec<ObjectId> = vec![];
    let mut all_objects = BTreeMap::new();

    // 1. Recorremos cada ruta absoluta que nos envió React
    for path in &file_paths {
        let mut doc =
            Document::load(path).map_err(|e| format!("Error al cargar {}: {}", path, e))?;

        // 2. Renumeramos los punteros para evitar colisiones entre PDFs
        doc.renumber_objects_with(max_id);
        max_id = doc.max_id + 1;

        // 3. Extraemos las referencias a las páginas
        let doc_pages = doc.get_pages();
        for (_, object_id) in doc_pages {
            pages_object_ids.push(object_id);
        }

        // 4. Acumulamos todos los objetos en nuestro mapa principal
        all_objects.extend(doc.objects);
    }

    // 5. Construimos el nodo "Pages" (índice de páginas)
    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    pages_dict.set(
        "Count",
        Object::Integer(pages_object_ids.len() as i64),
    );
    pages_dict.set(
        "Kids",
        Object::Array(
            pages_object_ids
                .iter()
                .map(|id| Object::Reference(*id))
                .collect(),
        ),
    );

    let pages_id = (max_id, 0);
    all_objects.insert(pages_id, Object::Dictionary(pages_dict));

    // 6. FIX CRÍTICO: Actualizar el Parent de cada página hija
    for page_id in &pages_object_ids {
        if let Some(Object::Dictionary(ref mut dict)) = all_objects.get_mut(page_id) {
            dict.set("Parent", Object::Reference(pages_id));
        }
    }

    // 7. Construimos el Catálogo
    let mut catalog = Dictionary::new();
    catalog.set("Type", Object::Name(b"Catalog".to_vec()));
    catalog.set("Pages", Object::Reference(pages_id));

    let catalog_id = (max_id + 1, 0);
    all_objects.insert(catalog_id, Object::Dictionary(catalog));

    // 8. Ensamblamos el documento final
    paged_doc.objects = all_objects;
    paged_doc.trailer.set("Root", Object::Reference(catalog_id));
    paged_doc.max_id = paged_doc.objects.keys().map(|k| k.0).max().unwrap_or(0);

    // 9. Escribimos el archivo al disco
    paged_doc
        .save(&output_path)
        .map_err(|e| format!("Error al guardar archivo final: {}", e))?;

    Ok(format!(
        "PDF unido exitosamente ({} archivos). Guardado en: {}",
        file_paths.len(),
        output_path
    ))
}

// ============================================================
// SPLIT: Extraer un rango de páginas de un PDF
// ============================================================
#[tauri::command]
async fn extract_pdf_pages(
    file_path: String,
    start_page: u32,
    end_page: u32,
    output_path: String,
) -> Result<String, String> {
    let doc =
        Document::load(&file_path).map_err(|e| format!("Error al cargar {}: {}", file_path, e))?;

    let pages = doc.get_pages();
    let total_pages = pages.len() as u32;

    if start_page < 1 || end_page > total_pages || start_page > end_page {
        return Err(format!(
            "Rango inválido: {}-{} (el PDF tiene {} páginas)",
            start_page, end_page, total_pages
        ));
    }

    // Recolectamos los IDs de las páginas que queremos extraer
    let mut sorted_pages: Vec<(u32, ObjectId)> = pages.into_iter().collect();
    sorted_pages.sort_by_key(|(num, _)| *num);

    let selected_ids: Vec<ObjectId> = sorted_pages
        .iter()
        .filter(|(num, _)| *num >= start_page && *num <= end_page)
        .map(|(_, id)| *id)
        .collect();

    build_pdf_from_pages(&doc, &selected_ids, &output_path)?;

    let extracted = end_page - start_page + 1;
    Ok(format!(
        "{} página(s) extraída(s). Guardado en: {}",
        extracted, output_path
    ))
}

// ============================================================
// SPLIT: Dividir un PDF cada N páginas
// ============================================================
#[tauri::command]
async fn split_pdf_every_n(
    file_path: String,
    pages_per_file: u32,
    output_folder: String,
) -> Result<Vec<String>, String> {
    if pages_per_file < 1 {
        return Err("Las páginas por archivo deben ser al menos 1.".to_string());
    }

    let doc =
        Document::load(&file_path).map_err(|e| format!("Error al cargar {}: {}", file_path, e))?;

    let pages = doc.get_pages();
    let total_pages = pages.len() as u32;

    let mut sorted_pages: Vec<(u32, ObjectId)> = pages.into_iter().collect();
    sorted_pages.sort_by_key(|(num, _)| *num);

    // Extraemos el nombre base del archivo original
    let base_name = Path::new(&file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("documento");

    let mut created_files: Vec<String> = vec![];
    let mut part = 1;
    let mut i: u32 = 0;

    while i < total_pages {
        let end = std::cmp::min(i + pages_per_file, total_pages);
        let chunk_ids: Vec<ObjectId> = sorted_pages[i as usize..end as usize]
            .iter()
            .map(|(_, id)| *id)
            .collect();

        let output_path = format!(
            "{}{}{}_{}.pdf",
            output_folder,
            std::path::MAIN_SEPARATOR,
            base_name,
            part
        );

        build_pdf_from_pages(&doc, &chunk_ids, &output_path)?;
        created_files.push(output_path);

        i = end;
        part += 1;
    }

    Ok(created_files)
}

// ============================================================
// ORGANIZE: Guardar PDF con páginas reorganizadas/rotadas/eliminadas
// ============================================================
#[tauri::command]
async fn save_organized_pdf(
    file_path: String,
    page_order: Vec<u32>,
    rotations: std::collections::HashMap<u32, i64>,
    output_path: String,
) -> Result<String, String> {
    let doc =
        Document::load(&file_path).map_err(|e| format!("Error al cargar {}: {}", file_path, e))?;

    let pages = doc.get_pages();
    let mut sorted_pages: Vec<(u32, ObjectId)> = pages.into_iter().collect();
    sorted_pages.sort_by_key(|(num, _)| *num);

    // Construimos la lista de IDs según el nuevo orden
    let mut selected_ids: Vec<ObjectId> = vec![];
    for &page_num in &page_order {
        let page_entry = sorted_pages
            .iter()
            .find(|(num, _)| *num == page_num)
            .ok_or_else(|| format!("Página {} no encontrada en el PDF", page_num))?;
        selected_ids.push(page_entry.1);
    }

    // Construimos el nuevo PDF
    let _new_doc = build_pdf_from_pages(&doc, &selected_ids, &output_path)?;

    // Aplicamos rotaciones
    // Necesitamos recargar para modificar rotaciones
    if !rotations.is_empty() {
        let mut reload_doc = Document::load(&output_path)
            .map_err(|e| format!("Error al recargar para rotar: {}", e))?;

        let reload_pages = reload_doc.get_pages();
        let mut reload_sorted: Vec<(u32, ObjectId)> = reload_pages.into_iter().collect();
        reload_sorted.sort_by_key(|(num, _)| *num);

        for (idx, &original_page_num) in page_order.iter().enumerate() {
            if let Some(&rotation) = rotations.get(&original_page_num) {
                if rotation != 0 {
                    let new_page_num = (idx + 1) as u32;
                    if let Some((_, obj_id)) =
                        reload_sorted.iter().find(|(num, _)| *num == new_page_num)
                    {
                        if let Some(Object::Dictionary(ref mut dict)) =
                            reload_doc.objects.get_mut(obj_id)
                        {
                            dict.set("Rotate", Object::Integer(rotation));
                        }
                    }
                }
            }
        }

        reload_doc
            .save(&output_path)
            .map_err(|e| format!("Error al guardar rotaciones: {}", e))?;
    }

    Ok(format!(
        "PDF organizado ({} páginas). Guardado en: {}",
        page_order.len(),
        output_path
    ))
}

// ============================================================
// HELPER: Construir un nuevo PDF a partir de páginas seleccionadas
// ============================================================
fn build_pdf_from_pages(
    source_doc: &Document,
    page_ids: &[ObjectId],
    output_path: &str,
) -> Result<Document, String> {
    let mut max_id = 1;
    let mut new_doc = Document::with_version("1.5");
    let mut all_objects = BTreeMap::new();

    // Recolectamos todos los objetos referenciados por las páginas seleccionadas
    for &page_id in page_ids {
        collect_page_objects(source_doc, page_id, &mut all_objects);
    }

    // Renumeramos
    let mut id_mapping: BTreeMap<ObjectId, ObjectId> = BTreeMap::new();
    let mut renumbered_objects = BTreeMap::new();

    for (old_id, obj) in &all_objects {
        let new_id = (max_id, 0);
        id_mapping.insert(*old_id, new_id);
        renumbered_objects.insert(new_id, obj.clone());
        max_id += 1;
    }

    // Actualizamos todas las referencias internas
    for obj in renumbered_objects.values_mut() {
        update_references(obj, &id_mapping);
    }

    // Construimos Pages dict
    let new_page_ids: Vec<ObjectId> = page_ids
        .iter()
        .filter_map(|id| id_mapping.get(id).copied())
        .collect();

    let mut pages_dict = Dictionary::new();
    pages_dict.set("Type", Object::Name(b"Pages".to_vec()));
    pages_dict.set("Count", Object::Integer(new_page_ids.len() as i64));
    pages_dict.set(
        "Kids",
        Object::Array(
            new_page_ids
                .iter()
                .map(|id| Object::Reference(*id))
                .collect(),
        ),
    );

    let pages_id = (max_id, 0);
    renumbered_objects.insert(pages_id, Object::Dictionary(pages_dict));

    // Actualizamos Parent de cada página
    for page_id in &new_page_ids {
        if let Some(Object::Dictionary(ref mut dict)) = renumbered_objects.get_mut(page_id) {
            dict.set("Parent", Object::Reference(pages_id));
        }
    }

    // Catálogo
    let mut catalog = Dictionary::new();
    catalog.set("Type", Object::Name(b"Catalog".to_vec()));
    catalog.set("Pages", Object::Reference(pages_id));

    let catalog_id = (max_id + 1, 0);
    renumbered_objects.insert(catalog_id, Object::Dictionary(catalog));

    new_doc.objects = renumbered_objects;
    new_doc.trailer.set("Root", Object::Reference(catalog_id));
    new_doc.max_id = new_doc.objects.keys().map(|k| k.0).max().unwrap_or(0);

    new_doc
        .save(output_path)
        .map_err(|e| format!("Error al guardar: {}", e))?;

    Ok(new_doc)
}

// ============================================================
// HELPER: Recolectar recursivamente todos los objetos de una página
// ============================================================
fn collect_page_objects(
    doc: &Document,
    obj_id: ObjectId,
    collected: &mut BTreeMap<ObjectId, Object>,
) {
    if collected.contains_key(&obj_id) {
        return;
    }

    if let Some(obj) = doc.objects.get(&obj_id) {
        collected.insert(obj_id, obj.clone());

        // Recorrer recursivamente las referencias dentro del objeto
        collect_references(obj, doc, collected);
    }
}

fn collect_references(
    obj: &Object,
    doc: &Document,
    collected: &mut BTreeMap<ObjectId, Object>,
) {
    match obj {
        Object::Reference(id) => {
            // No seguimos la referencia a "Parent" para evitar ciclos
            collect_page_objects(doc, *id, collected);
        }
        Object::Dictionary(dict) => {
            for (key, value) in dict.iter() {
                let key_str = std::str::from_utf8(key).unwrap_or("");
                // Evitamos seguir "Parent" para prevenir ciclos infinitos
                if key_str != "Parent" {
                    collect_references(value, doc, collected);
                }
            }
        }
        Object::Array(arr) => {
            for item in arr {
                collect_references(item, doc, collected);
            }
        }
        Object::Stream(stream) => {
            collect_references(&Object::Dictionary(stream.dict.clone()), doc, collected);
        }
        _ => {}
    }
}

fn update_references(obj: &mut Object, mapping: &BTreeMap<ObjectId, ObjectId>) {
    match obj {
        Object::Reference(ref mut id) => {
            if let Some(new_id) = mapping.get(id) {
                *id = *new_id;
            }
        }
        Object::Dictionary(dict) => {
            for (_, value) in dict.iter_mut() {
                update_references(value, mapping);
            }
        }
        Object::Array(arr) => {
            for item in arr.iter_mut() {
                update_references(item, mapping);
            }
        }
        Object::Stream(stream) => {
            for (_, value) in stream.dict.iter_mut() {
                update_references(value, mapping);
            }
        }
        _ => {}
    }
}

// ============================================================
// PUNTO DE ENTRADA DE LA APP TAURI
// ============================================================
#[tauri::command]
fn open_result_file(file_path: String) -> Result<String, String> {
    match opener::open(&file_path) {
        Ok(_) => Ok(format!("Archivo guardado como {}", file_path)),
        Err(e) => Err(format!("No se pudo abrir el archivo: {}", e)),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            merge_pdfs,
            get_pdf_page_count,
            read_pdf_file,
            extract_pdf_pages,
            split_pdf_every_n,
            save_organized_pdf,
            open_result_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
