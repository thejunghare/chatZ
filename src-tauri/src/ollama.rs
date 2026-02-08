use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OllamaMessage {
    pub role: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<String>,
}

#[derive(Serialize, Debug)]
pub struct ChatRequest {
    pub model: String,
    pub messages: Vec<OllamaMessage>,
    pub stream: bool,
}

#[derive(Deserialize, Debug)]
pub struct ChatResponse {
    pub model: String,
    pub created_at: String,
    pub message: Option<OllamaMessage>,
    pub done: bool,
}

pub struct OllamaClient {
    client: Client,
    base_url: String,
}

impl OllamaClient {
    pub fn new(base_url: String) -> Self {
        Self {
            client: Client::new(),
            base_url,
        }
    }

    pub async fn chat<F>(
        &self,
        model: &str,
        messages: Vec<OllamaMessage>,
        callback: F,
    ) -> Result<String, Box<dyn Error + Send + Sync>>
    where
        F: Fn(String) + Send + Sync + 'static,
    {
        let url = format!("{}/api/chat", self.base_url);
        let request = ChatRequest {
            model: model.to_string(),
            messages,
            stream: true,
        };

        let mut stream = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await?
            .bytes_stream();

        let mut full_response = String::new();
        let mut is_thinking = false;

        while let Some(item) = stream.next().await {
            let chunk = item?;
            let chunk_str = String::from_utf8_lossy(&chunk);

            // Ollama sends JSON objects, potentially multiple in one chunk or split across chunks?
            // Usually it's line-delimited JSON or just one JSON per chunk if flushed.
            // But we should parse it carefully.
            // However, often simple line splitting works for Ollama.

            for line in chunk_str.lines() {
                if line.is_empty() {
                    continue;
                }
                if let Ok(response) = serde_json::from_str::<ChatResponse>(line) {
                    if let Some(msg) = response.message {
                        // Handle thinking
                        if let Some(ref think_content) = msg.thinking {
                            if !think_content.is_empty() {
                                if !is_thinking {
                                    let tag = "<think>\n";
                                    full_response.push_str(tag);
                                    callback(tag.to_string());
                                    is_thinking = true;
                                }
                                full_response.push_str(think_content);
                                callback(think_content.clone());
                            }
                        }

                        // Handle content
                        if !msg.content.is_empty() {
                            if is_thinking {
                                let tag = "\n</think>\n";
                                full_response.push_str(tag);
                                callback(tag.to_string());
                                is_thinking = false;
                            }
                            full_response.push_str(&msg.content);
                            callback(msg.content);
                        }
                    }
                    if response.done {
                        if is_thinking {
                            let tag = "\n</think>\n";
                            full_response.push_str(tag);
                            callback(tag.to_string());
                            is_thinking = false;
                        }
                        break;
                    }
                }
            }
        }

        Ok(full_response)
    }

    pub async fn list_models(&self) -> Result<Vec<String>, Box<dyn Error + Send + Sync>> {
        let url = format!("{}/api/tags", self.base_url);

        #[derive(Deserialize)]
        struct ModelListResponse {
            models: Vec<ModelInfo>,
        }

        #[derive(Deserialize)]
        struct ModelInfo {
            name: String,
        }

        let resp = self
            .client
            .get(&url)
            .send()
            .await?
            .json::<ModelListResponse>()
            .await?;
        Ok(resp.models.into_iter().map(|m| m.name).collect())
    }
}
