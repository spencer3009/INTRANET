import { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  Upload, Loader2, X, Trash2, Download, FileText,
  FolderOpen, AlertCircle, Check, Paperclip,
  FileVideo, Image as ImageIcon, File as FileIcon
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function MaterialTableContent({ subjectId, token, user }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Form state
  const [description, setDescription] = useState("");
  const [file, setFile] = useState(null);
  const [fileType, setFileType] = useState("pdf");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  // Fetch materials
  useEffect(() => {
    const fetchMaterials = async () => {
      try {
        const res = await axios.get(`${API}/course/${subjectId}/posts?post_type=material&limit=100`, { headers });
        setMaterials(res.data.posts || []);
      } catch (err) {
        console.error('Error fetching materials:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMaterials();
  }, [subjectId, token]);
  
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('El archivo no debe superar 25MB');
      return;
    }
    
    setFile(selectedFile);
    setError("");
    
    // Auto-detect file type
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (['pdf'].includes(ext)) setFileType('pdf');
    else if (['doc', 'docx'].includes(ext)) setFileType('word');
    else if (['xls', 'xlsx'].includes(ext)) setFileType('excel');
    else if (['ppt', 'pptx'].includes(ext)) setFileType('powerpoint');
    else if (['mp4', 'avi', 'mov', 'wmv'].includes(ext)) setFileType('video');
    else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) setFileType('image');
    else setFileType('other');
  };
  
  const uploadToCloudinary = async (fileToUpload, folder, isRawFile = false) => {
    const resourceType = isRawFile ? 'raw' : 'auto';
    
    const signatureRes = await axios.get(
      `${API}/cloudinary/signature?folder=${folder}&resource_type=${resourceType}`,
      { headers }
    );
    const { signature, timestamp, cloud_name, api_key, folder: uploadFolder, access_mode } = signatureRes.data;
    
    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('signature', signature);
    formData.append('timestamp', timestamp);
    formData.append('api_key', api_key);
    formData.append('folder', uploadFolder);
    
    if (access_mode) {
      formData.append('access_mode', access_mode);
    }
    
    const uploadEndpoint = isRawFile ? 'raw' : 'auto';
    
    const uploadRes = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloud_name}/${uploadEndpoint}/upload`,
      formData,
      {
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      }
    );
    
    return uploadRes.data.secure_url;
  };
  
  const handleSubmit = async () => {
    if (!description.trim()) {
      setError("La descripción es requerida");
      return;
    }
    
    if (!file) {
      setError("Debes seleccionar un archivo");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      const isRawFile = !file.type.startsWith('image/');
      const fileUrl = await uploadToCloudinary(file, 'edunet/materials', isRawFile);
      
      const res = await axios.post(`${API}/course/${subjectId}/posts`, {
        subject_id: subjectId,
        title: description.trim(),
        content: `Archivo: ${file.name} (${(file.size / 1024).toFixed(2)}KB)`,
        post_type: "material",
        file_url: fileUrl,
        file_name: file.name,
        file_type: file.type || 'application/octet-stream',
        file_size: file.size
      }, { headers });
      
      setMaterials([res.data, ...materials]);
      setShowCreateModal(false);
      resetForm();
    } catch (err) {
      console.error('Error uploading material:', err);
      setError("Error al subir el material. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  const resetForm = () => {
    setDescription("");
    setFile(null);
    setFileType("pdf");
    setError("");
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  
  const handleDeleteClick = (material) => {
    setMaterialToDelete(material);
    setShowDeleteModal(true);
  };
  
  const handleDeleteConfirm = async () => {
    if (!materialToDelete) return;
    setDeleting(true);
    try {
      await axios.delete(`${API}/course/posts/${materialToDelete.id}`, { headers });
      setMaterials(materials.filter(m => m.id !== materialToDelete.id));
      setShowDeleteModal(false);
      setMaterialToDelete(null);
    } catch (err) {
      console.error('Error deleting material:', err);
    } finally {
      setDeleting(false);
    }
  };
  
  const handleDownload = (material) => {
    if (material.file_url) {
      window.open(material.file_url, '_blank');
    }
  };
  
  const getFileIcon = (material) => {
    const fileName = material.file_name || material.title || '';
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (ext === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
    if (['doc', 'docx'].includes(ext)) return <FileText className="w-5 h-5 text-blue-500" />;
    if (['xls', 'xlsx'].includes(ext)) return <FileText className="w-5 h-5 text-green-500" />;
    if (['ppt', 'pptx'].includes(ext)) return <FileText className="w-5 h-5 text-orange-500" />;
    if (['mp4', 'avi', 'mov'].includes(ext)) return <FileVideo className="w-5 h-5 text-purple-500" />;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return <ImageIcon className="w-5 h-5 text-pink-500" />;
    return <FileIcon className="w-5 h-5 text-slate-500" />;
  };
  
  const extractFileInfo = (material) => {
    const content = material.content || '';
    const match = content.match(/Archivo:\s*(.+?)\s*\((.+?)\)/);
    if (match) {
      return { name: match[1], size: match[2] };
    }
    return { 
      name: material.file_name || 'Archivo', 
      size: material.file_size ? `${(material.file_size / 1024).toFixed(2)}KB` : '' 
    };
  };
  
  return (
    <div className="space-y-6 pt-6 pb-48">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Material de estudio</h2>
          <div className="w-8 h-1 bg-orange-500 rounded-full mt-2"></div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-semibold transition-all flex items-center justify-center shadow-lg shadow-orange-500/25"
          data-testid="upload-material-btn"
        >
          <Upload className="w-6 h-6" />
        </button>
      </div>
      
      {/* Materials List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : materials.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                <FolderOpen className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No hay materiales</h3>
              <p className="text-slate-400 mb-6">Sube el primer material de estudio</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Subir material
              </button>
            </div>
          ) : (
            materials.map((material) => {
              const fileInfo = extractFileInfo(material);
              return (
                <div key={material.id} className="flex items-center px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{material.title}</p>
                    <div className="flex items-center gap-2 text-slate-500">
                      {getFileIcon(material)}
                      <span className="text-sm">{fileInfo.name}</span>
                      {fileInfo.size && (
                        <span className="text-xs text-slate-400">({fileInfo.size})</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                    <button
                      onClick={() => handleDownload(material)}
                      className="w-9 h-9 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg flex items-center justify-center transition-colors"
                      title="Descargar"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(material)}
                      className="w-9 h-9 bg-red-100 hover:bg-red-200 text-red-600 rounded-lg flex items-center justify-center transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => { setShowCreateModal(false); resetForm(); }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5" />
                Subir material de estudio
              </h3>
              <button 
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Descripción *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Escribe una descripción del material..."
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-orange-400 focus:bg-white transition-all resize-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Archivo *
                </label>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.avi,.mov,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors flex items-center gap-2"
                  >
                    <Paperclip className="w-4 h-4" />
                    Seleccionar archivo
                  </button>
                  {file && (
                    <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-orange-50 rounded-xl border border-orange-200">
                      <FileText className="w-4 h-4 text-orange-500" />
                      <span className="text-sm text-slate-700 truncate">{file.name}</span>
                      <span className="text-xs text-slate-400">({(file.size / 1024).toFixed(2)}KB)</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Tipo de archivo
                </label>
                <select
                  value={fileType}
                  onChange={(e) => setFileType(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-orange-400 focus:bg-white transition-all"
                >
                  <option value="pdf">PDF</option>
                  <option value="word">Word (DOC/DOCX)</option>
                  <option value="excel">Excel (XLS/XLSX)</option>
                  <option value="powerpoint">PowerPoint (PPT/PPTX)</option>
                  <option value="video">Video</option>
                  <option value="image">Imagen</option>
                  <option value="other">Otro</option>
                </select>
              </div>
              
              {submitting && uploadProgress > 0 && (
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-amber-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || !description.trim() || !file}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Guardar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800">Eliminar material</h3>
                <p className="text-sm text-slate-500">Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-slate-600 mb-6">
              ¿Estás seguro de que deseas eliminar "<strong>{materialToDelete?.title}</strong>"?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
