import { openDB } from 'idb'

const DB_NAME = 'syntax-skills'
const STORE = 'favorites'

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE, { keyPath: 'id' })
    }
  })
}

export async function addFavorite(item) {
  const db = await getDb()
  await db.put(STORE, { ...item, savedAt: Date.now() })
}

export async function removeFavorite(id) {
  const db = await getDb()
  await db.delete(STORE, id)
}

export async function listFavorites() {
  const db = await getDb()
  const all = await db.getAll(STORE)
  return all.sort((a, b) => b.savedAt - a.savedAt)
}

export async function isFavorite(id) {
  const db = await getDb()
  const item = await db.get(STORE, id)
  return Boolean(item)
}
