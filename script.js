// Configuración de Supabase
const SUPABASE_URL = 'https://vbnmppchglwkivvkvmkv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_f1lt6p76RfxuVSFIwYcoyw_u_XgVzjp';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales de la app
let allMemories = [];
let activeCategory = 'all';
let memoryToDelete = null; // Guarda temporalmente la foto a eliminar

// Elementos del DOM
const gallery = document.getElementById('gallery');
const emptyState = document.getElementById('empty-state');
const uploadModal = document.getElementById('upload-modal');
const lightboxModal = document.getElementById('lightbox-modal');
const confirmModal = document.getElementById('confirm-modal');
const uploadForm = document.getElementById('upload-form');
const submitBtn = document.getElementById('submit-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
  loadMemories();
  setupEventListeners();
});

// --- Escuchadores de Eventos ---
function setupEventListeners() {
  // Modal de Subida
  document.getElementById('open-upload-btn').addEventListener('click', () => uploadModal.classList.remove('hidden'));
  document.getElementById('close-upload-btn').addEventListener('click', () => uploadModal.classList.add('hidden'));

  // Modal de Lightbox
  document.getElementById('close-lightbox-btn').addEventListener('click', () => lightboxModal.classList.add('hidden'));

  // Modal de Confirmar Eliminación
  document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    memoryToDelete = null;
  });
  confirmDeleteBtn.addEventListener('click', deleteMemory);

  // Enviar Formulario de Carga
  uploadForm.addEventListener('submit', handleUpload);

  // Filtros de Categoría
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeCategory = e.target.getAttribute('data-category');
      renderGallery();
    });
  });

// Deslizador de Tamaño de Fotos
  const sizeSlider = document.getElementById('size-slider');
  if (sizeSlider) {
    sizeSlider.addEventListener('input', (e) => {
      const newSize = e.target.value;
      document.documentElement.style.setProperty('--card-min-width', `${newSize}px`);
    });
  }
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
      <button class="delete-card-btn" title="Eliminar este recuerdo">🗑️</button>
      <div class="polaroid-img-container">
        <img src="${memory.imagen_url}" alt="${memory.titulo}" loading="lazy">
      </div>
      <div class="polaroid-caption">
        <h3 class="polaroid-title">${memory.titulo}</h3>
        <p class="polaroid-date">📅 ${formatDate(memory.fecha)}</p>
      </div>
    `;

    // Clic en el botón de eliminar (evita abrir el lightbox)
    const deleteBtn = card.querySelector('.delete-card-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Evita abrir la foto al hacer clic en borrar
      memoryToDelete = memory;
      confirmModal.classList.remove('hidden');
    });

    // Clic en la tarjeta para abrir Lightbox
    card.addEventListener('click', () => openLightbox(memory));
    gallery.appendChild(card);
  });
}

// --- Eliminar Recuerdo ---
async function deleteMemory() {
  if (!memoryToDelete) return;

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Borrando... ⏳';

  try {
    // 1. Eliminar de la base de datos Supabase
    const { error: dbError } = await supabaseClient
      .from('recuerdos')
      .delete()
      .eq('id', memoryToDelete.id);

    if (dbError) throw dbError;

    // 2. Eliminar la imagen del Storage de Supabase
    if (memoryToDelete.imagen_url) {
      const urlParts = memoryToDelete.imagen_url.split('/fotos-recuerdos/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabaseClient
          .storage
          .from('fotos-recuerdos')
          .remove([filePath]);
      }
    }

    // Cerrar modal y refrescar la galería
    confirmModal.classList.add('hidden');
    memoryToDelete = null;
    await loadMemories();

  } catch (err) {
    alert('Error al eliminar la foto: ' + err.message);
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Sí, borrar 🗑️';
  }
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
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `galeria/${fileName}`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from('fotos-recuerdos')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabaseClient
      .storage
      .from('fotos-recuerdos')
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

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
