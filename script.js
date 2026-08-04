// Configuración de Supabase
const SUPABASE_URL = 'https://vbnmppchglwkivvkvmkv.supabase.co';
const SUPABASE_KEY = 'sb_publishable_f1lt6p76RfxuVSFIwYcoyw_u_XgVzjp';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Variables globales de la app
let allMemories = [];
let activeCategory = 'all';
let memoryToDelete = null;

// Variables para el carrusel del Lightbox
let currentMemoryImages = [];
let currentImageIndex = 0;

// Elementos del DOM
const gallery = document.getElementById('gallery');
const emptyState = document.getElementById('empty-state');
const uploadModal = document.getElementById('upload-modal');
const lightboxModal = document.getElementById('lightbox-modal');
const confirmModal = document.getElementById('confirm-modal');
const uploadForm = document.getElementById('upload-form');
const submitBtn = document.getElementById('submit-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

// Elementos del Lightbox
const lightboxImg = document.getElementById('lightbox-img');
const prevImgBtn = document.getElementById('prev-img-btn');
const nextImgBtn = document.getElementById('next-img-btn');
const lightboxCounter = document.getElementById('lightbox-counter');

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
  loadMemories();
  setupEventListeners();
});

// --- Escuchadores de Eventos ---
function setupEventListeners() {
  // Modales
  document.getElementById('open-upload-btn').addEventListener('click', () => uploadModal.classList.remove('hidden'));
  document.getElementById('close-upload-btn').addEventListener('click', () => uploadModal.classList.add('hidden'));
  document.getElementById('close-lightbox-btn').addEventListener('click', () => lightboxModal.classList.add('hidden'));

  document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    confirmModal.classList.add('hidden');
    memoryToDelete = null;
  });
  confirmDeleteBtn.addEventListener('click', deleteMemory);

  // Formulario y Filtros
  uploadForm.addEventListener('submit', handleUpload);

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      activeCategory = e.target.getAttribute('data-category');
      renderGallery();
    });
  });

  // Slider de tamaño de fotos
  const sizeSlider = document.getElementById('size-slider');
  if (sizeSlider) {
    sizeSlider.addEventListener('input', (e) => {
      document.documentElement.style.setProperty('--card-min-width', `${e.target.value}px`);
    });
  }

  // Navegación con flechas en Lightbox
  prevImgBtn.addEventListener('click', () => navigateImage(-1));
  nextImgBtn.addEventListener('click', () => navigateImage(1));
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
    const images = memory.imagenes_urls && memory.imagenes_urls.length > 0 
      ? memory.imagenes_urls 
      : [memory.imagen_url];

    const isMultiple = images.length > 1;

    const card = document.createElement('div');
    card.className = `polaroid ${isMultiple ? 'stacked' : ''}`;
    
    card.innerHTML = `
      ${isMultiple ? `<span class="count-badge">📸 ${images.length} fotos</span>` : ''}
      <button class="delete-card-btn" title="Eliminar este recuerdo">🗑️</button>
      <div class="polaroid-img-container">
        <img src="${images[0]}" alt="${memory.titulo}" loading="lazy">
      </div>
      <div class="polaroid-caption">
        <h3 class="polaroid-title">${memory.titulo}</h3>
        <p class="polaroid-date">📅 ${formatDate(memory.fecha)}</p>
      </div>
    `;

    // Clic en eliminar
    const deleteBtn = card.querySelector('.delete-card-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      memoryToDelete = memory;
      confirmModal.classList.remove('hidden');
    });

    // Clic en la tarjeta
    card.addEventListener('click', () => openLightbox(memory));
    gallery.appendChild(card);
  });
}

// --- Subida de Múltiples Fotos ---
async function handleUpload(e) {
  e.preventDefault();
  
  const fileInput = document.getElementById('photo-file');
  const title = document.getElementById('photo-title').value;
  const date = document.getElementById('photo-date').value;
  const category = document.getElementById('photo-category').value;
  const note = document.getElementById('photo-note').value;
  
  const files = Array.from(fileInput.files);
  if (files.length === 0) return;

  submitBtn.disabled = true;
  submitBtn.textContent = `Subiendo ${files.length} foto(s)... 💖`;

  try {
    const uploadedUrls = [];

    // Subir cada archivo individualmente a Supabase Storage
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${i}.${fileExt}`;
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

      uploadedUrls.push(urlData.publicUrl);
    }

    // Guardar registro en la base de datos
    const { error: dbError } = await supabaseClient
      .from('recuerdos')
      .insert([{
        titulo: title,
        nota: note,
        fecha: date,
        categoria: category,
        imagen_url: uploadedUrls[0], // Compatibilidad previa
        imagenes_urls: uploadedUrls  // Arreglo completo de URLs
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

// --- Ver en Pantalla Completa (Lightbox Carrusel) ---
function openLightbox(memory) {
  currentMemoryImages = memory.imagenes_urls && memory.imagenes_urls.length > 0 
    ? memory.imagenes_urls 
    : [memory.imagen_url];
  
  currentImageIndex = 0;

  document.getElementById('lightbox-title').textContent = memory.titulo;
  document.getElementById('lightbox-badge').textContent = memory.categoria;
  document.getElementById('lightbox-date').textContent = `📅 ${formatDate(memory.fecha)}`;
  document.getElementById('lightbox-note').textContent = memory.nota;

  updateLightboxImage();
  lightboxModal.classList.remove('hidden');
}

// Actualizar la foto actual en el Lightbox
function updateLightboxImage() {
  lightboxImg.src = currentMemoryImages[currentImageIndex];
  
  if (currentMemoryImages.length > 1) {
    lightboxCounter.textContent = `${currentImageIndex + 1} / ${currentMemoryImages.length}`;
    lightboxCounter.style.display = 'block';
    prevImgBtn.classList.remove('hidden');
    nextImgBtn.classList.remove('hidden');
  } else {
    lightboxCounter.style.display = 'none';
    prevImgBtn.classList.add('hidden');
    nextImgBtn.classList.add('hidden');
  }
}

// Cambiar de foto con flechas
function navigateImage(direction) {
  currentImageIndex += direction;
  
  // Ciclo infinito en el carrusel
  if (currentImageIndex < 0) {
    currentImageIndex = currentMemoryImages.length - 1;
  } else if (currentImageIndex >= currentMemoryImages.length) {
    currentImageIndex = 0;
  }

  updateLightboxImage();
}

// --- Eliminar Recuerdo ---
async function deleteMemory() {
  if (!memoryToDelete) return;

  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Borrando... ⏳';

  try {
    const { error: dbError } = await supabaseClient
      .from('recuerdos')
      .delete()
      .eq('id', memoryToDelete.id);

    if (dbError) throw dbError;

    // Intentar borrar las fotos asociadas del storage
    const images = memoryToDelete.imagenes_urls || [memoryToDelete.imagen_url];
    const filePaths = images.map(url => {
      const parts = url.split('/fotos-recuerdos/');
      return parts.length > 1 ? parts[1] : null;
    }).filter(path => path !== null);

    if (filePaths.length > 0) {
      await supabaseClient.storage.from('fotos-recuerdos').remove(filePaths);
    }

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

// Helper para formato de fecha
function formatDate(dateStr) {
  if (!dateStr) return '';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('es-ES', options);
}
