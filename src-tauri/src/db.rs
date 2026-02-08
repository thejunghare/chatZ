use chrono::Utc;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Thread {
    pub id: i64,
    pub title: String,
    pub created_at: String,
    pub system_prompt: Option<String>,
    pub is_archived: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Message {
    pub id: i64,
    pub thread_id: i64,
    pub role: String,
    pub content: String,
    pub images: Option<Vec<String>>,
    pub model: Option<String>,
    pub created_at: String,
    pub thinking_process: Option<String>,
    pub total_duration: Option<i64>,
    pub load_duration: Option<i64>,
    pub prompt_eval_count: Option<i64>,
    pub eval_count: Option<i64>,
    pub eval_duration: Option<i64>,
    pub tokens_per_second: Option<f64>,
    pub reply_to_id: Option<i64>,
}

pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS threads (
                id INTEGER PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                system_prompt TEXT,
                is_archived BOOLEAN DEFAULT 0
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY,
                thread_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                images TEXT,
                model TEXT,
                thinking_process TEXT,
                total_duration INTEGER,
                load_duration INTEGER,
                prompt_eval_count INTEGER,
                eval_count INTEGER,
                eval_duration INTEGER,
                tokens_per_second REAL,
                reply_to_id INTEGER,
                FOREIGN KEY(thread_id) REFERENCES threads(id),
                FOREIGN KEY(reply_to_id) REFERENCES messages(id) ON DELETE SET NULL
            )",
            [],
        )?;

        // Migrations for existing tables
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN images TEXT", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN model TEXT", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN thinking_process TEXT", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN total_duration INTEGER", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN load_duration INTEGER", []);
        let _ = conn.execute(
            "ALTER TABLE messages ADD COLUMN prompt_eval_count INTEGER",
            [],
        );
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN eval_count INTEGER", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN eval_duration INTEGER", []);
        let _ = conn.execute("ALTER TABLE messages ADD COLUMN tokens_per_second REAL", []);

        // Migration for threads table
        let _ = conn.execute("ALTER TABLE threads ADD COLUMN system_prompt TEXT", []);
        let _ = conn.execute(
            "ALTER TABLE threads ADD COLUMN is_archived BOOLEAN DEFAULT 0",
            [],
        );

        // Check if reply_to_id column exists
        let has_reply_to_id: bool = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('messages') WHERE name='reply_to_id'",
                [],
                |row: &rusqlite::Row| row.get(0),
            )
            .unwrap_or(false);

        if !has_reply_to_id {
            let _ = conn.execute("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL", []);
        }

        Ok(Database { conn })
    }

    pub fn create_thread(&self, title: &str, system_prompt: Option<String>) -> Result<i64> {
        let now = Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO threads (title, created_at, system_prompt, is_archived) VALUES (?1, ?2, ?3, 0)",
            params![title, now, system_prompt],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_threads(&self) -> Result<Vec<Thread>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, title, created_at, system_prompt, is_archived FROM threads WHERE is_archived = 0 ORDER BY created_at DESC",
        )?;
        let thread_iter = stmt.query_map([], |row| {
            Ok(Thread {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                system_prompt: row.get(3)?,
                is_archived: row.get(4)?,
            })
        })?;

        let mut threads = Vec::new();
        for thread in thread_iter {
            threads.push(thread?);
        }
        Ok(threads)
    }

    pub fn get_thread_system_prompt(&self, thread_id: i64) -> Result<Option<String>> {
        let mut stmt = self
            .conn
            .prepare("SELECT system_prompt FROM threads WHERE id = ?1")?;
        let mut rows = stmt.query(params![thread_id])?;

        if let Some(row) = rows.next()? {
            Ok(row.get(0)?)
        } else {
            Ok(None)
        }
    }

    pub fn archive_thread(&self, thread_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE threads SET is_archived = 1 WHERE id = ?1",
            params![thread_id],
        )?;
        Ok(())
    }

    pub fn add_message(
        &self,
        thread_id: i64,
        role: &str,
        content: &str,
        images: Option<Vec<String>>,
        model: Option<String>,
        reply_to_id: Option<i64>,
    ) -> Result<i64> {
        let now = Utc::now().to_rfc3339();
        let images_json = images.map(|imgs| serde_json::to_string(&imgs).unwrap_or_default());

        self.conn.execute(
            "INSERT INTO messages (thread_id, role, content, images, model, created_at, reply_to_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![thread_id, role, content, images_json, model, now, reply_to_id],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_messages(&self, thread_id: i64) -> Result<Vec<Message>> {
        let mut stmt = self.conn.prepare(
            "SELECT 
                id, thread_id, role, content, model, thinking_process,
                total_duration, load_duration, prompt_eval_count, eval_count, eval_duration, reply_to_id, created_at, images
             FROM messages WHERE thread_id = ?1 ORDER BY created_at ASC",
        )?;

        let message_iter = stmt.query_map(params![thread_id], |row| {
            let images_json: Option<String> = row.get(13)?;
            let images = if let Some(json) = images_json {
                serde_json::from_str(&json).unwrap_or_default()
            } else {
                Vec::new()
            };

            Ok(Message {
                id: row.get(0)?,
                thread_id,
                role: row.get(2)?,
                content: row.get(3)?,
                images: if images.is_empty() {
                    None
                } else {
                    Some(images)
                },
                model: row.get(4)?,
                thinking_process: row.get(5)?,
                total_duration: row.get(6)?,
                load_duration: row.get(7)?,
                prompt_eval_count: row.get(8)?,
                eval_count: row.get(9)?,
                eval_duration: row.get(10)?,
                reply_to_id: row.get(11)?,
                created_at: row.get(12)?,
                tokens_per_second: None, // Need to fix this if column exists or calculate it
            })
        })?;

        let mut messages = Vec::new();
        for message in message_iter {
            messages.push(message?);
        }

        Ok(messages)
    }

    pub fn update_thread_title(&self, thread_id: i64, new_title: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE threads SET title = ?1 WHERE id = ?2",
            params![new_title, thread_id],
        )?;
        Ok(())
    }

    pub fn delete_thread(&self, thread_id: i64) -> Result<()> {
        // First delete all messages in the thread
        self.conn.execute(
            "DELETE FROM messages WHERE thread_id = ?1",
            params![thread_id],
        )?;

        // Then delete the thread itself
        self.conn
            .execute("DELETE FROM threads WHERE id = ?1", params![thread_id])?;
        Ok(())
    }

    pub fn update_message(&self, message_id: i64, content: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE messages SET content = ?1 WHERE id = ?2",
            params![content, message_id],
        )?;
        Ok(())
    }

    pub fn delete_messages_from(&self, thread_id: i64, message_id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM messages WHERE thread_id = ?1 AND id >= ?2",
            params![thread_id, message_id],
        )?;
        Ok(())
    }

    pub fn delete_messages_after(&self, thread_id: i64, message_id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM messages WHERE thread_id = ?1 AND id > ?2",
            params![thread_id, message_id],
        )?;
        Ok(())
    }

    pub fn delete_last_message(&self, thread_id: i64) -> Result<()> {
        self.conn.execute(
            "DELETE FROM messages WHERE id = (SELECT id FROM messages WHERE thread_id = ?1 ORDER BY created_at DESC LIMIT 1)",
            params![thread_id],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_db_creation() {
        let db = Database::new(":memory:").unwrap();
        let threads = db.get_threads().unwrap();
        assert!(threads.is_empty());
    }

    #[test]
    fn test_create_thread_and_message() {
        let db = Database::new(":memory:").unwrap();
        let thread_id = db.create_thread("Test Thread", None).unwrap();

        let threads = db.get_threads().unwrap();
        assert_eq!(threads.len(), 1);
        assert_eq!(threads[0].title, "Test Thread");

        db.add_message(thread_id, "user", "Hello", None, None, None)
            .unwrap();
        db.add_message(
            thread_id,
            "assistant",
            "Hi",
            None,
            Some("llama2".to_string()),
            None,
        )
        .unwrap();

        let messages = db.get_messages(thread_id).unwrap();
        assert_eq!(messages.len(), 2);
        assert_eq!(messages[0].content, "Hello");
        assert_eq!(messages[1].content, "Hi");
        assert_eq!(messages[1].model, Some("llama2".to_string()));
    }

    #[test]
    fn test_db_performance() {
        let db = Database::new(":memory:").unwrap();
        let start = std::time::Instant::now();

        let thread_id = db.create_thread("Benchmark", None).unwrap();
        for i in 0..100 {
            db.add_message(
                thread_id,
                "user",
                &format!("Message {}", i),
                None,
                None,
                None,
            )
            .unwrap();
        }

        let messages = db.get_messages(thread_id).unwrap();
        assert_eq!(messages.len(), 100);

        let duration = start.elapsed();
        println!("Inserted and retrieved 100 messages in {:?}", duration);
        // Ensure it's reasonably fast (e.g. < 500ms for in-memory)
        assert!(duration.as_millis() < 500);
    }

    #[test]
    fn test_edit_and_delete() {
        let db = Database::new(":memory:").unwrap();
        let thread_id = db.create_thread("Edit Test", None).unwrap();

        let m1 = db
            .add_message(thread_id, "user", "msg1", None, None, None)
            .unwrap();
        db.add_message(thread_id, "assistant", "msg2", None, None, None)
            .unwrap();
        db.add_message(thread_id, "user", "msg3", None, None, None)
            .unwrap();

        // Update m1
        db.update_message(m1, "msg1_updated").unwrap();
        let msgs = db.get_messages(thread_id).unwrap();
        assert_eq!(msgs[0].content, "msg1_updated");

        // Delete after m1
        db.delete_messages_after(thread_id, m1).unwrap();
        let msgs = db.get_messages(thread_id).unwrap();
        assert_eq!(msgs.len(), 1);
        assert_eq!(msgs[0].id, m1);

        // Delete last (which is m1 now)
        db.delete_last_message(thread_id).unwrap();
        let msgs = db.get_messages(thread_id).unwrap();
        assert!(msgs.is_empty());
    }
}
