const SUPABASE_URL = 'https://utqyfqyazgbfmdcqbzuw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_rb88FCGN9-99ApgwyMWtlw_I4bZ2yF7';
const BUCKET = 'uploads';
const MAX_FILE_SIZE = 100 * 1024 * 1024;

const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const status = document.getElementById('status');
const filesList = document.getElementById('filesList');

if (fileInput && uploadBtn && status && filesList) {
  uploadBtn.addEventListener('click', uploadFile);
  loadFiles();
}

async function uploadFile() {
  const file = fileInput.files?.[0];
  if (!file) return setStatus('Kies eerst een muziek- of videobestand.', true);
  if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
    return setStatus('Alleen audio- en videobestanden zijn toegestaan.', true);
  }
  if (file.size > MAX_FILE_SIZE) return setStatus('Het bestand mag maximaal 100 MB zijn.', true);

  const filename = `${crypto.randomUUID()}-${sanitizeFilename(file.name)}`;
  const encodedPath = encodeURIComponent(filename);
  setStatus('Bezig met uploaden...');
  uploadBtn.disabled = true;

  try {
    const uploadResponse = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodedPath}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': file.type || 'application/octet-stream',
        'x-upsert': 'false'
      },
      body: file
    });
    if (!uploadResponse.ok) throw new Error(`Opslag upload mislukt (${uploadResponse.status}).`);

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodedPath}`;
    const databaseResponse = await fetch(`${SUPABASE_URL}/rest/v1/files`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation'
      },
      body: JSON.stringify({ name: file.name, path: filename, url: publicUrl })
    });
    if (!databaseResponse.ok) throw new Error(`Opslaan van bestandsgegevens mislukt (${databaseResponse.status}).`);

    const [savedFile] = await databaseResponse.json();
    addFileToList(savedFile || { name: file.name, url: publicUrl });
    fileInput.value = '';
    setStatus('Upload gelukt!');
  } catch (error) {
    console.error(error);
    setStatus(error.message || 'Er ging iets mis tijdens het uploaden.', true);
  } finally {
    uploadBtn.disabled = false;
  }
}

async function loadFiles() {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/files?select=id,name,url,created_at&order=created_at.desc`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    if (response.ok) (await response.json()).forEach(addFileToList);
  } catch (error) {
    console.warn('Bestanden konden niet worden geladen.', error);
  }
}

function addFileToList(file) {
  const item = document.createElement('li');
  const link = document.createElement('a');
  link.href = file.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = file.name;
  item.append(link);
  if (file.created_at) {
    const date = document.createElement('small');
    date.textContent = ` — ${new Date(file.created_at).toLocaleString('nl-NL')}`;
    item.append(date);
  }
  filesList.prepend(item);
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._() -]/g, '_').slice(0, 180);
}

function setStatus(message, isError = false) {
  status.textContent = message;
  status.style.color = isError ? '#f87171' : '';
}
