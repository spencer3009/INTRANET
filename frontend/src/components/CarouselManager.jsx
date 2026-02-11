import { useState, useRef, useCallback, useEffect } from "react";
import ReactCrop from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import axios from "axios";
import { 
  Image, Plus, Trash2, GripVertical, Eye, EyeOff, X, 
  Upload, Crop, Check, Loader2, AlertCircle, Move
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Crop Modal Component
function CropModal({ isOpen, onClose, imageFile, onCropComplete, token }) {
  const [crop, setCrop] = useState({ unit: "%", width: 100, aspect: 16 / 9 });
  const [completedCrop, setCompletedCrop] = useState(null);
  const [imgSrc, setImgSrc] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const imgRef = useRef(null);
  const headers = { Authorization: `Bearer ${token}` };

  // Load image when file changes - FIXED: use useEffect instead of useState
  useEffect(() => {
    if (imageFile) {
      setImgSrc(""); // Reset first
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
      setCrop({ unit: "%", width: 100, aspect: 16 / 9 });
      setCompletedCrop(null);
      setError("");
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

  const handleUpload = async () => {
    setError("");
    setUploading(true);

    try {
      const croppedBlob = await getCroppedImg();
      if (!croppedBlob) {
        setError("Error al recortar la imagen");
        setUploading(false);
        return;
      }

      // Upload to Cloudinary
      const formData = new FormData();
      formData.append("file", croppedBlob, "banner.jpg");
      formData.append("upload_preset", cloudinaryConfig.upload_preset);
      formData.append("folder", `edunet/banners`);

      const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloud_name}/image/upload`;
      const uploadRes = await axios.post(cloudinaryUrl, formData);

      if (uploadRes.data?.secure_url) {
        onCropComplete(uploadRes.data.secure_url);
        onClose();
      } else {
        setError("Error al subir la imagen");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.response?.data?.error?.message || "Error al subir la imagen");
    } finally {
      setUploading(false);
    }
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
                <Crop className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Recortar Imagen</h2>
                <p className="text-xs text-white/60">Ajusta el área visible del banner (16:9)</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
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
            onClick={onClose}
            className="px-5 py-2.5 text-slate-600 hover:bg-slate-200 rounded-xl font-medium transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleUpload}
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
                <Check className="w-4 h-4" />
                Guardar Banner
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Banner Card Component
function BannerCard({ banner, onToggle, onDelete, onDragStart, onDragOver, onDrop, isDragging }) {
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
        <div className="flex items-center gap-2">
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

  // Cloudinary config
  const cloudinaryConfig = {
    cloud_name: "dqtpywu4a",
    upload_preset: "edunet_unsigned"
  };

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

  // Handle crop complete
  const handleCropComplete = async (imageUrl) => {
    setSaving(true);
    try {
      await axios.post(`${API}/dashboard/banners`, { image_url: imageUrl }, { headers });
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
        cloudinaryConfig={cloudinaryConfig}
      />
    </div>
  );
}
