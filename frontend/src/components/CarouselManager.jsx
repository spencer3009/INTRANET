import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import axios from "axios";
import { 
  Image, Plus, Trash2, GripVertical, Eye, EyeOff, X, 
  Upload, Crop, Check, Loader2, AlertCircle, Move, Pencil
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Crop Modal Component
function CropModal({ isOpen, onClose, imageFile, onCropComplete, token }) {
  const [step, setStep] = useState(1); // 1 = crop, 2 = text
  const [crop, setCrop] = useState({ unit: "%", width: 100, aspect: 16 / 9 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [imgSrc, setImgSrc] = useState("");
  const [croppedImageUrl, setCroppedImageUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  const MAX_TITLE = 50;
  const MAX_DESC = 100;

  // Load image when file changes
  useEffect(() => {
    if (imageFile) {
      setImgSrc("");
      setCroppedImageUrl("");
      setStep(1);
      setTitle("");
      setDescription("");
      const reader = new FileReader();
      reader.onload = () => {
        setImgSrc(reader.result?.toString() || "");
      };
      reader.onerror = () => {
        setError("Error al cargar la imagen");
      };
      reader.readAsDataURL(imageFile);
    }
  }, [imageFile]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setImgSrc("");
      setCroppedImageUrl("");
      setCrop({ unit: "%", width: 100, aspect: 16 / 9 });
      setCompletedCrop(null);
      setError("");
      setStep(1);
      setTitle("");
      setDescription("");
    }
  }, [isOpen]);

  const onImageLoad = useCallback((e) => {
    const { width, height } = e.currentTarget;
    // Set initial crop to center with 16:9 aspect
    const cropWidth = Math.min(100, (height * 16) / (width * 9) * 100);
    setCrop({
      unit: "%",
      width: cropWidth,
      height: cropWidth * (9 / 16) * (width / height),
      x: (100 - cropWidth) / 2,
      y: 0,
      aspect: 16 / 9
    });
  }, []);

  const getCroppedImg = useCallback(async () => {
    if (!completedCrop || !imgRef.current) return null;

    const image = imgRef.current;
    const canvas = document.createElement("canvas");
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    // Output size (max 1920x1080 for 16:9)
    const outputWidth = Math.min(1920, completedCrop.width * scaleX);
    const outputHeight = outputWidth * (9 / 16);

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        "image/jpeg",
        0.9
      );
    });
  }, [completedCrop]);

  // Step 1: Upload cropped image to Cloudinary
  const handleUploadImage = async () => {
    setError("");
    setUploading(true);

    try {
      const croppedBlob = await getCroppedImg();
      if (!croppedBlob) {
        setError("Error al recortar la imagen");
        setUploading(false);
        return;
      }

      // Get Cloudinary signature from backend
      const sigRes = await axios.get(`${API}/cloudinary/signature?folder=edunet/banners&resource_type=image`, { headers });
      const { signature, timestamp, cloud_name, api_key, folder } = sigRes.data;

      // Upload to Cloudinary with signature
      const formData = new FormData();
      formData.append("file", croppedBlob, "banner.jpg");
      formData.append("api_key", api_key);
      formData.append("timestamp", timestamp);
      formData.append("signature", signature);
      formData.append("folder", folder);

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`;
      const uploadRes = await axios.post(cloudinaryUrl, formData);

      if (uploadRes.data?.secure_url) {
        setCroppedImageUrl(uploadRes.data.secure_url);
        setStep(2); // Go to text step
      } else {
        setError("Error al subir la imagen");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.response?.data?.error?.message || err.response?.data?.detail || "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  // Step 2: Save banner with title and description
  const handleSaveBanner = () => {
    onCropComplete(croppedImageUrl, title, description);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001f4b] to-[#003366] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                {step === 1 ? <Crop className="w-5 h-5 text-white" /> : <Image className="w-5 h-5 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  {step === 1 ? "Paso 1: Recortar Imagen" : "Paso 2: Agregar Texto"}
                </h2>
                <p className="text-xs text-white/60">
                  {step === 1 ? "Ajusta el área visible del banner (16:9)" : "Título y descripción del banner"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Step indicators */}
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 1 ? 'bg-[#e1b82c] text-[#001f4b]' : 'bg-white/20 text-white/60'}`}>1</div>
                <div className="w-6 h-0.5 bg-white/30" />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= 2 ? 'bg-[#e1b82c] text-[#001f4b]' : 'bg-white/20 text-white/60'}`}>2</div>
              </div>
              <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl ml-2">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 ? (
            <>
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4 flex items-start gap-3">
                <Move className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">Arrastra para ajustar el área visible</p>
                  <p className="text-xs text-blue-600 mt-1">La imagen se recortará en formato horizontal (16:9) para el carrusel</p>
                </div>
              </div>

              {/* Crop Area */}
              <div className="bg-slate-100 rounded-xl p-4 flex items-center justify-center min-h-[300px] max-h-[400px] overflow-auto">
                {imgSrc ? (
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={16 / 9}
                    className="max-w-full"
                  >
                    <img
                      ref={imgRef}
                      src={imgSrc}
                      alt="Crop preview"
                      onLoad={onImageLoad}
                      className="max-h-[350px] w-auto"
                    />
                  </ReactCrop>
                ) : (
                  <div className="text-slate-400 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <p>Cargando imagen...</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Preview with text overlay */}
              <div className="relative rounded-xl overflow-hidden mb-6">
                <img src={croppedImageUrl} alt="Banner preview" className="w-full h-48 object-cover" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#001f4b]/90 via-[#001f4b]/60 to-transparent" />
                <div className="absolute inset-0 flex items-center p-6">
                  <div className="max-w-[50%]">
                    <h3 className="text-xl font-bold text-white mb-2">{title || "Título del banner"}</h3>
                    <p className="text-sm text-white/80">{description || "Descripción del banner..."}</p>
                  </div>
                </div>
              </div>

              {/* Text inputs */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Título <span className="text-slate-400 font-normal">({title.length}/{MAX_TITLE})</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                    placeholder="Ej: Bienvenidos al año escolar 2026"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none transition-all"
                    maxLength={MAX_TITLE}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Descripción <span className="text-slate-400 font-normal">({description.length}/{MAX_DESC})</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                    placeholder="Ej: Conoce las novedades de este nuevo ciclo escolar"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none transition-all resize-none"
                    rows={2}
                    maxLength={MAX_DESC}
                  />
                </div>
                <p className="text-xs text-slate-400">
                  💡 El texto ocupará aproximadamente la mitad izquierda del banner
                </p>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between">
          <button
            onClick={step === 1 ? onClose : () => setStep(1)}
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors"
          >
            {step === 1 ? "Cancelar" : "← Volver"}
          </button>
          {step === 1 ? (
            <button
              onClick={handleUploadImage}
              disabled={uploading || !completedCrop}
              className="px-6 py-2.5 bg-[#001f4b] hover:bg-[#002a5c] disabled:bg-slate-300 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                <>
                  Siguiente →
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleSaveBanner}
              className="px-6 py-2.5 bg-[#e1b82c] hover:bg-[#c9a526] text-[#001f4b] rounded-xl font-bold flex items-center gap-2 transition-colors"
            >
              <Check className="w-4 h-4" />
              Guardar Banner
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Edit Modal Component
function EditBannerModal({ isOpen, onClose, banner, onSave }) {
  const [title, setTitle] = useState(banner?.title || "");
  const [description, setDescription] = useState(banner?.description || "");
  const [saving, setSaving] = useState(false);

  const MAX_TITLE = 50;
  const MAX_DESC = 100;

  useEffect(() => {
    if (banner) {
      setTitle(banner.title || "");
      setDescription(banner.description || "");
    }
  }, [banner]);

  const handleSave = async () => {
    setSaving(true);
    await onSave(banner.id, title, description);
    setSaving(false);
    onClose();
  };

  if (!isOpen || !banner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#001f4b] to-[#003366] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Pencil className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Editar Banner</h2>
                <p className="text-xs text-white/60">Modifica el título y descripción</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Preview */}
          <div className="relative rounded-xl overflow-hidden mb-6">
            <img src={banner.image_url} alt="Banner preview" className="w-full h-40 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#001f4b]/90 via-[#001f4b]/60 to-transparent" />
            <div className="absolute inset-0 flex items-center p-6">
              <div className="max-w-[50%]">
                <h3 className="text-lg font-bold text-white mb-1">{title || "Título del banner"}</h3>
                <p className="text-sm text-white/80">{description || "Descripción del banner..."}</p>
              </div>
            </div>
          </div>

          {/* Text inputs */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Título <span className="text-slate-400 font-normal">({title.length}/{MAX_TITLE})</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                placeholder="Ej: Bienvenidos al año escolar 2026"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none transition-all"
                maxLength={MAX_TITLE}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Descripción <span className="text-slate-400 font-normal">({description.length}/{MAX_DESC})</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESC))}
                placeholder="Ej: Conoce las novedades de este nuevo ciclo escolar"
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#001f4b]/20 focus:border-[#001f4b] outline-none transition-all resize-none"
                rows={2}
                maxLength={MAX_DESC}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#e1b82c] hover:bg-[#c9a526] disabled:bg-slate-300 text-[#001f4b] rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// Banner Card Component
function BannerCard({ banner, onToggle, onDelete, onEdit, onDragStart, onDragOver, onDrop, isDragging }) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, banner.id)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, banner.id)}
      className={`group relative bg-white rounded-xl border-2 ${
        isDragging ? "border-[#e1b82c] shadow-lg" : "border-slate-200"
      } overflow-hidden transition-all hover:shadow-md`}
    >
      {/* Image */}
      <div className="relative h-32 bg-slate-100">
        <img
          src={banner.image_url}
          alt="Banner"
          className={`w-full h-full object-cover ${!banner.active ? "opacity-50 grayscale" : ""}`}
        />
        {/* Title overlay */}
        {banner.title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
            <p className="text-white text-xs font-medium truncate">{banner.title}</p>
          </div>
        )}
        {!banner.active && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="px-3 py-1 bg-black/60 text-white text-xs font-bold rounded-full">
              DESACTIVADO
            </span>
          </div>
        )}
        
        {/* Drag Handle */}
        <div className="absolute top-2 left-2 p-1.5 bg-white/90 rounded-lg cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-slate-500" />
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          Orden: {banner.order + 1}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(banner)}
            className="p-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition-colors"
            title="Editar texto"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggle(banner.id, !banner.active)}
            className={`p-2 rounded-lg transition-colors ${
              banner.active
                ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"
                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
            }`}
            title={banner.active ? "Desactivar" : "Activar"}
          >
            {banner.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onClick={() => onDelete(banner.id)}
            className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function CarouselManager({ token }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [draggedId, setDraggedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const headers = { Authorization: `Bearer ${token}` };

  // Load banners
  const loadBanners = async () => {
    try {
      const res = await axios.get(`${API}/dashboard/banners`, { headers });
      setBanners(res.data || []);
    } catch (err) {
      console.error("Error loading banners:", err);
    } finally {
      setLoading(false);
    }
  };

  // FIXED: use useEffect instead of useState
  useEffect(() => {
    loadBanners();
  }, []);

  // Handle file select
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        alert("Por favor selecciona una imagen válida");
        return;
      }
      setSelectedFile(file);
      setShowCropModal(true);
    }
    e.target.value = "";
  };

  // Handle crop complete - now receives title and description
  const handleCropComplete = async (imageUrl, title, description) => {
    setSaving(true);
    try {
      await axios.post(`${API}/dashboard/banners`, { 
        image_url: imageUrl,
        title: title || "",
        description: description || ""
      }, { headers });
      loadBanners();
    } catch (err) {
      console.error("Error creating banner:", err);
      alert(err.response?.data?.detail || "Error al crear el banner");
    } finally {
      setSaving(false);
      setSelectedFile(null);
    }
  };

  // Toggle banner active state
  const handleToggle = async (bannerId, active) => {
    try {
      await axios.put(`${API}/dashboard/banners/${bannerId}`, { active }, { headers });
      setBanners(prev => prev.map(b => b.id === bannerId ? { ...b, active } : b));
    } catch (err) {
      console.error("Error toggling banner:", err);
    }
  };

  // Delete banner
  const handleDelete = async (bannerId) => {
    if (!confirm("¿Eliminar este banner?")) return;
    try {
      await axios.delete(`${API}/dashboard/banners/${bannerId}`, { headers });
      setBanners(prev => prev.filter(b => b.id !== bannerId));
    } catch (err) {
      console.error("Error deleting banner:", err);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e, targetId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = banners.findIndex(b => b.id === draggedId);
    const targetIndex = banners.findIndex(b => b.id === targetId);

    const newBanners = [...banners];
    const [removed] = newBanners.splice(draggedIndex, 1);
    newBanners.splice(targetIndex, 0, removed);

    // Update order
    const reorderedBanners = newBanners.map((b, i) => ({ ...b, order: i }));
    setBanners(reorderedBanners);

    // Save to backend
    try {
      await axios.put(`${API}/dashboard/banners/reorder`, {
        banner_ids: reorderedBanners.map(b => b.id)
      }, { headers });
    } catch (err) {
      console.error("Error reordering banners:", err);
    }

    setDraggedId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#001f4b]" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#001f4b] to-[#003366] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Image className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Carrusel del Dashboard</h3>
              <p className="text-sm text-white/60">Administra las imágenes del banner principal</p>
            </div>
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={saving}
            className="px-5 py-2.5 bg-[#e1b82c] hover:bg-[#c9a526] text-[#001f4b] rounded-xl font-bold flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Agregar Imagen
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {banners.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <Image className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h4 className="text-lg font-bold text-slate-600 mb-2">Sin imágenes</h4>
            <p className="text-sm text-slate-400 mb-6">Agrega imágenes para mostrar en el carrusel del dashboard</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-[#001f4b] hover:bg-[#002a5c] text-white rounded-xl font-semibold inline-flex items-center gap-2"
            >
              <Upload className="w-5 h-5" />
              Subir primera imagen
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-500 mb-4">
              <GripVertical className="w-4 h-4 inline mr-1" />
              Arrastra las imágenes para reordenar • {banners.filter(b => b.active).length} de {banners.length} activas
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {banners.map(banner => (
                <BannerCard
                  key={banner.id}
                  banner={banner}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDragging={draggedId === banner.id}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Crop Modal */}
      <CropModal
        isOpen={showCropModal}
        onClose={() => {
          setShowCropModal(false);
          setSelectedFile(null);
        }}
        imageFile={selectedFile}
        onCropComplete={handleCropComplete}
        token={token}
      />
    </div>
  );
}
