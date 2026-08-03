// Configuración de Supabase
const SUPABASE_URL = 'https://vbnmppchglwkivvkvmkv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_f1lt6p76RfxuVSFIwYcoyw_u_XgVzjp';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales de la app
let allMemories = [];
let activeCategory = 'all';

// Elementos del DOM
const gallery = document.getElementById('gallery');
const emptyState = document.getElementById('empty-state');
const uploadModal = document.getElementById('upload-modal');
const lightboxModal = document.getElementById('lightbox-modal');
const uploadForm = document.getElementById('upload-form');
const submitBtn = document.getElementById('submit-btn');

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
  loadMemories();
  setupEventListeners();
});

// --- Escuchadores de Eventos ---
function setupEventListeners() {
  // Abrir y cerrar modal de carga
  document.getElementById('open-upload-btn').addEventListener('click', () => uploadModal.classList.remove('hidden'));
  document.getElementById('close-upload-btn').addEventListener('click', () => uploadModal.classList.add('hidden'));

  // Cerrar lightbox
  document.getElementById('close-lightbox-btn').addEventListener('click', () => lightboxModal.classList.add('hidden'));

  // Enviar formulario de fotos
  uploadForm.addEventListener('submit', handleUpload);

  // Filtros de categoría
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeCategory = e.target.getAttribute('data-category');
      renderGallery();
    });
  });
}

// --- Cargar recuerdos desde Supabase ---
async function loadMemories() {
  try {
    const { data, error } = await supabaseClient
      .from('recuerdos')
      .select('*')
      .order('fecha', { ascending: false });

    if (error) throw error;

    allMemories = data || [];
    renderGallery();
  } catch (err) {
    console.error('Error al cargar recuerdos:', err.message);
  }
}

// --- Renderizar Galería ---
function renderGallery() {
  gallery.innerHTML = '';

  const filtered = activeCategory === 'all' 
    ? allMemories 
    : allMemories.filter(m => m.categoria === activeCategory);

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  filtered.forEach(memory => {
    const card = document.createElement('div');
    card.className = 'polaroid';
    card.innerHTML = `
      <div class="polaroid-img-container">
        <img src="${memory.imagen_url}" alt="${memory.titulo}" loading="lazy">
      </div>
      <div class="polaroid-caption">
        <h3 class="polaroid-title">${memory.titulo}</h3>
        <p class="polaroid-date">📅 ${formatDate(memory.fecha)}</p>
      </div>
    `;

    card.addEventListener('click', () => openLightbox(memory));
    gallery.appendChild(card);
  });
}

// --- Manejar Subida de Foto ---
async function handleUpload(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('photo-file');
  const title = document.getElementById('photo-title').value;
  const date = document.getElementById('photo-date').value;
  const category = document.getElementById('photo-category').value;
  const note = document.getElementById('photo-note').value;
  
  const file = fileInput.files[0];
  if (!file) return;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Subiendo recuerdo... 💖';

  try {
    // 1. Subir imagen al Bucket 'fotos-recuerdos'
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `galeria/${fileName}`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from('fotos-recuerdos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // 2. Obtener URL pública de la foto
    const { data: urlData } = supabaseClient
      .storage
      .from('fotos-recuerdos')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    // 3. Guardar registro en la tabla 'recuerdos'
    const { error: dbError } = await supabaseClient
      .from('recuerdos')
      .insert([{
        titulo: title,
        nota: note,
        fecha: date,
        categoria: category,
        imagen_url: publicUrl
      }]);

    if (dbError) throw dbError;

    // Resetear y cerrar modal
    uploadForm.reset();
    uploadModal.classList.add('hidden');
    await loadMemories();

  } catch (err) {
    alert('Error al guardar el recuerdo: ' + err.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Guardar para Siempre 💕';
  }
}

// --- Ver en Pantalla Completa (Lightbox) ---
function openLightbox(memory) {
  document.getElementById('lightbox-img').src = memory.imagen_url;
  document.getElementById('lightbox-title').textContent = memory.titulo;
  document.getElementById('lightbox-badge').textContent = memory.categoria;
  document.getElementById('lightbox-date').textContent = `📅 ${formatDate(memory.fecha)}`;
  document.getElementById('lightbox-note').textContent = memory.nota;

  lightboxModal.classList.remove('hidden');
}

// Helper para formato de fecha
function formatDate(dateStr) {
  if (!dateStr) return '';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', options);
}
