import { join } from 'path';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { v4 as uuidv4 } from 'uuid';

export interface Message {
  id: string;
  name: string;
  end_of_id: string;
  remark: string;
  creator_name: string;
  source: string;
  status: 'pending' | 'submitted';
  created_at: string;
  updated_at: string;
}

interface DbData {
  messages: Message[];
}

const dbPath = join(process.cwd(), 'data', 'db.json');
const adapter = new JSONFile<DbData>(dbPath);
const defaultData: DbData = { messages: [] };
const db = new Low<DbData>(adapter, defaultData);

export async function initDb() {
  await db.read();
  db.data ||= defaultData;
  await db.write();
}

export async function getDb() {
  await db.read();
  db.data ||= defaultData;
  return db;
}

export async function getAllMessages(status?: string): Promise<Message[]> {
  const db = await getDb();
  let messages = db.data.messages;
  if (status) {
    messages = messages.filter(m => m.status === status);
  }
  return messages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function createMessage(data: Omit<Message, 'id' | 'status' | 'created_at' | 'updated_at'>): Promise<Message> {
  const db = await getDb();
  const now = new Date().toISOString();
  const message: Message = {
    id: uuidv4(),
    ...data,
    status: 'pending',
    created_at: now,
    updated_at: now,
  };
  db.data.messages.push(message);
  await db.write();
  return message;
}

export async function updateMessage(id: string, data: Partial<Omit<Message, 'id' | 'created_at'>>): Promise<Message | null> {
  const db = await getDb();
  const idx = db.data.messages.findIndex(m => m.id === id);
  if (idx === -1) return null;
  db.data.messages[idx] = {
    ...db.data.messages[idx],
    ...data,
    updated_at: new Date().toISOString(),
  };
  await db.write();
  return db.data.messages[idx];
}

export async function deleteMessage(id: string): Promise<boolean> {
  const db = await getDb();
  const before = db.data.messages.length;
  db.data.messages = db.data.messages.filter(m => m.id !== id);
  await db.write();
  return db.data.messages.length < before;
}

export async function deleteMessages(ids: string[]): Promise<number> {
  const db = await getDb();
  const before = db.data.messages.length;
  const idSet = new Set(ids);
  db.data.messages = db.data.messages.filter(m => !idSet.has(m.id));
  await db.write();
  return before - db.data.messages.length;
}

export async function markAsSubmitted(ids: string[]): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  db.data.messages = db.data.messages.map(m =>
    ids.includes(m.id) ? { ...m, status: 'submitted', updated_at: now } : m
  );
  await db.write();
}
