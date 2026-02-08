pub mod db;
pub mod ollama;
pub mod pdf_utils;

use base64::{engine::general_purpose, Engine as _};
use db::{Database, Message, Thread};
use ollama::{OllamaClient, OllamaMessage};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};

struct AppState {
    db: Mutex<Database>,
    ollama: OllamaClient,
}

#[tauri::command]
fn create_thread(
    state: State<AppState>,
    title: String,
    system_prompt: Option<String>,
) -> Result<Thread, String> {
    let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
    let id = db
        .create_thread(&title, system_prompt.clone())
        .map_err(|e| e.to_string())?;
    Ok(Thread {
        id,
        title,
        created_at: chrono::Utc::now().to_rfc3339(), // Approximate return
        system_prompt,
        is_archived: false,
    })
}

#[tauri::command]
fn get_threads(state: State<AppState>) -> Result<Vec<Thread>, String> {
    let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
    db.get_threads().map_err(|e| e.to_string())
}

#[tauri::command]
fn get_messages(state: State<AppState>, thread_id: i64) -> Result<Vec<Message>, String> {
    let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
    db.get_messages(thread_id).map_err(|e| e.to_string())
}

async fn generate_response_stream(
    app: AppHandle,
    state: State<'_, AppState>,
    thread_id: i64,
    model: String,
) -> Result<(), String> {
    // 1. Prepare context (fetch recent messages)
    let history = {
        let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
        let system_prompt = db
            .get_thread_system_prompt(thread_id)
            .map_err(|e| e.to_string())?;
        let messages = db.get_messages(thread_id).map_err(|e| e.to_string())?;

        let mut ollama_messages = Vec::new();

        if let Some(prompt) = system_prompt {
            if !prompt.is_empty() {
                ollama_messages.push(OllamaMessage {
                    role: "system".to_string(),
                    content: prompt,
                    images: None,
                    thinking: None,
                });
            }
        }

        ollama_messages.extend(messages.into_iter().map(|m| OllamaMessage {
            role: m.role,
            content: m.content,
            images: m.images,
            thinking: None,
        }));

        ollama_messages
    };

    // 2. Call Ollama and stream
    let app_handle_clone = app.clone();
    let response_content = state
        .ollama
        .chat(&model, history, move |chunk| {
            let _ = app_handle_clone.emit("stream-response", chunk);
        })
        .await
        .map_err(|e| e.to_string())?;

    // 3. Save AI message
    {
        let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
        db.add_message(
            thread_id,
            "assistant",
            &response_content,
            None,
            Some(model),
            None,
        )
        .map_err(|e| e.to_string())?;
    }

    // Emit done event
    let _ = app.emit("stream-done", ());

    Ok(())
}

#[tauri::command]
async fn send_message(
    app: AppHandle,
    state: State<'_, AppState>,
    thread_id: i64,
    mut content: String,
    images: Option<Vec<String>>,
    pdfs: Option<Vec<String>>,
    model: String,
    reply_to_id: Option<i64>,
) -> Result<(), String> {
    // Process PDF attachments if any
    if let Some(pdf_list) = pdfs {
        for (i, pdf_base64) in pdf_list.iter().enumerate() {
            // Remove data:application/pdf;base64, prefix if present
            let clean_base64 = pdf_base64
                .find(',')
                .map_or(pdf_base64.as_str(), |idx| &pdf_base64[idx + 1..]);

            if let Ok(bytes) = general_purpose::STANDARD.decode(clean_base64) {
                match pdf_utils::extract_text_from_pdf(&bytes) {
                    Ok(text) => {
                        content.push_str(&format!("\n\n--- PDF Attachment {} Content ---\n{}\n-----------------------------------\n", i + 1, text));
                    }
                    Err(e) => {
                        content.push_str(&format!(
                            "\n\n[System Error: Failed to extract text from PDF Attachment {}]",
                            i + 1
                        ));
                        eprintln!("Failed to extract PDF text: {}", e);
                    }
                }
            }
        }
    }

    // Save user message
    {
        let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
        db.add_message(
            thread_id,
            "user",
            &content,
            images,
            Some(model.clone()),
            reply_to_id,
        )
        .map_err(|e| e.to_string())?;
    }
    generate_response_stream(app, state, thread_id, model).await
}

#[tauri::command]
async fn regenerate_response(
    app: AppHandle,
    state: State<'_, AppState>,
    thread_id: i64,
    model: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
        let messages = db.get_messages(thread_id).map_err(|e| e.to_string())?;
        if let Some(last) = messages.last() {
            if last.role == "assistant" {
                db.delete_last_message(thread_id)
                    .map_err(|e| e.to_string())?;
            }
        }
    }
    generate_response_stream(app, state, thread_id, model).await
}

#[tauri::command]
async fn edit_message(
    app: AppHandle,
    state: State<'_, AppState>,
    thread_id: i64,
    message_id: i64,
    new_content: String,
    model: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
        // Update the message content
        db.update_message(message_id, &new_content)
            .map_err(|e| e.to_string())?;

        // Delete all subsequent messages (to invalidate old conversation flow)
        db.delete_messages_after(thread_id, message_id)
            .map_err(|e| e.to_string())?;
    }

    // Regenerate response from this point
    generate_response_stream(app, state, thread_id, model).await
}

#[tauri::command]
async fn delete_message(
    state: State<'_, AppState>,
    thread_id: i64,
    message_id: i64,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
    db.delete_messages_from(thread_id, message_id)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn delete_thread(state: State<'_, AppState>, thread_id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
    db.delete_thread(thread_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn rename_thread(
    state: State<'_, AppState>,
    thread_id: i64,
    new_title: String,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
    db.update_thread_title(thread_id, &new_title)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn list_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.ollama.list_models().await.map_err(|e| e.to_string())
}

#[tauri::command]
async fn regenerate_from_message(
    app: AppHandle,
    state: State<'_, AppState>,
    thread_id: i64,
    message_id: i64,
    model: String,
) -> Result<(), String> {
    {
        let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
        db.delete_messages_from(thread_id, message_id)
            .map_err(|e| e.to_string())?;
    }
    generate_response_stream(app, state, thread_id, model).await
}

#[tauri::command]
async fn archive_thread(state: State<'_, AppState>, thread_id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|_| "Failed to lock DB")?;
    db.archive_thread(thread_id).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_path = "chat.db"; // In production, use app_data_dir
    let db = Database::new(db_path).expect("Failed to initialize database");
    let ollama = OllamaClient::new("http://localhost:11434".to_string());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            db: Mutex::new(db),
            ollama,
        })
        .invoke_handler(tauri::generate_handler![
            create_thread,
            get_threads,
            get_messages,
            send_message,
            regenerate_response,
            edit_message,
            delete_message,
            delete_thread,
            rename_thread,
            list_models,
            archive_thread,
            regenerate_from_message,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
