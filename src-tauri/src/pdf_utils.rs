use lopdf::Document;
use std::io::Cursor;

pub fn extract_text_from_pdf(bytes: &[u8]) -> Result<String, Box<dyn std::error::Error>> {
    // Load the PDF document from bytes
    let doc = Document::load_from(Cursor::new(bytes))?;
    
    // Get all page numbers
    let pages = doc.get_pages();
    let mut texts = Vec::new();

    // Sort pages by number to ensure correct order
    let mut page_numbers: Vec<u32> = pages.keys().cloned().collect();
    page_numbers.sort();

    for page_num in page_numbers {
        // Extract text from each page
        // Note: extract_text takes a slice of page numbers, we do one by one here
        if let Ok(text) = doc.extract_text(&[page_num]) {
            if !text.trim().is_empty() {
                texts.push(text);
            }
        }
    }

    Ok(texts.join("\n\n"))
}
