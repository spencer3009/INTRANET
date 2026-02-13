import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  MessageCircle, X, Upload, Eye, EyeOff, AlertCircle,
  Loader2, Check, File as FileIcon,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Highlighter
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Rich Text Editor for Forum (emerald theme)
function RichTextEditorForum({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] }
      }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder || "Escribe aquí..." }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[120px] px-4 py-3",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  if (!editor) return null;

  const ToolButton = ({ onClick, active, icon: Icon, title }) => (
    <button
      type="button"
      onClick={onClick}
      className={`p-2 rounded-lg transition-colors ${
        active ? "bg-emerald-100 text-emerald-700" : "hover:bg-slate-100 text-slate-500"
      }`}
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-emerald-400 transition-colors bg-white">
      <div className="flex items-center gap-1 px-2 py-2 bg-slate-50 border-b border-slate-200 flex-wrap">
        <ToolButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          icon={Bold}
          title="Negrita"
        />
        <ToolButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          icon={Italic}
          title="Cursiva"
        />
        <ToolButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          icon={UnderlineIcon}
          title="Subrayado"
        />
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <ToolButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          icon={List}
          title="Lista"
        />
        <ToolButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          icon={ListOrdered}
          title="Lista numerada"
        />
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <ToolButton
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
          icon={AlignLeft}
          title="Alinear izquierda"
        />
        <ToolButton
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
          icon={AlignCenter}
          title="Centrar"
        />
        <ToolButton
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
          icon={AlignRight}
          title="Alinear derecha"
        />
        <div className="w-px h-5 bg-slate-300 mx-1" />
        <ToolButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive("highlight")}
          icon={Highlighter}
          title="Resaltar"
        />
        <ToolButton
          onClick={() => {
            const url = window.prompt("URL del enlace:");
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          active={editor.isActive("link")}
          icon={LinkIcon}
          title="Enlace"
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export default function PremiumForumModal({ isOpen, onClose, subjectId, token, user, onPostCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [showToStudents, setShowToStudents] = useState(true);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);
  
  const headers = { Authorization: `Bearer ${token}` };
  
  useEffect(() => {
    if (!isOpen) {
      setTitle("");
      setDescription("");
      setShowToStudents(true);
      setFile(null);
      setError("");
      setUploadProgress(0);
    }
  }, [isOpen]);
  
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('El archivo no debe superar 25MB');
      return;
    }
    
    setFile(selectedFile);
    setError("");
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
    if (!title.trim()) {
      setError("El título del tema es requerido");
      return;
    }
    
    if (!description.trim()) {
      setError("La descripción del tema es requerida");
      return;
    }
    
    setSubmitting(true);
    setError("");
    
    try {
      let fileUrl = null;
      let fileName = null;
      let fileType = null;
      
      if (file) {
        const isRawFile = !file.type.startsWith('image/');
        fileUrl = await uploadToCloudinary(file, 'edunet/posts', isRawFile);
        fileName = file.name;
        fileType = file.type || 'application/octet-stream';
      }
      
      const res = await axios.post(`${API}/course/${subjectId}/posts`, {
        subject_id: subjectId,
        title: title.trim(),
        content: description.trim(),
        post_type: "forum",
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        metadata: {
          show_to_students: showToStudents
        }
      }, { headers });
      
      onPostCreated(res.data.post);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear el tema');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  if (!isOpen) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRoLTEydjJoMTJ2LTJ6bTAtNGgtMTJ2MmgxMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
          
          <div className="relative px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Nuevo Tema</h2>
                <p className="text-sm text-white/80">Inicia una discusión con la clase</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
          
          {/* Title */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Título del tema <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Debate sobre el cambio climático"
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-emerald-400 focus:bg-white transition-all"
              data-testid="forum-title-input"
            />
          </div>
          
          {/* Visibility Toggle */}
          <div className="mb-5 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${showToStudents ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                  {showToStudents ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Mostrar a estudiantes</p>
                  <p className="text-xs text-slate-400">
                    {showToStudents ? 'Los estudiantes podrán ver y participar' : 'Solo visible para profesores'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToStudents(!showToStudents)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                  showToStudents ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                data-testid="forum-visibility-toggle"
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                  showToStudents ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
          
          {/* Description */}
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Descripción del tema <span className="text-red-500">*</span>
            </label>
            <RichTextEditorForum
              value={description}
              onChange={setDescription}
              placeholder="Describe el tema de discusión y las reglas de participación..."
            />
          </div>
          
          {/* File Attachment */}
          <div className="mb-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Adjuntar material <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            
            {file ? (
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <FileIcon className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-700 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button 
                  onClick={() => setFile(null)} 
                  className="w-8 h-8 bg-slate-200 hover:bg-red-100 hover:text-red-600 rounded-lg flex items-center justify-center text-slate-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all group">
                <div className="w-14 h-14 bg-slate-100 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center mb-3 transition-colors">
                  <Upload className="w-7 h-7 text-slate-400 group-hover:text-emerald-600 transition-colors" />
                </div>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-emerald-700">Arrastra o haz clic para subir</p>
                <p className="text-xs text-slate-400 mt-1">PDF, Word, imágenes hasta 25MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar,.jpg,.jpeg,.png,.gif"
                />
              </label>
            )}
          </div>
          
          {/* Upload Progress */}
          {submitting && uploadProgress > 0 && (
            <div className="mt-4 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-emerald-700">Subiendo archivo...</span>
                <span className="font-bold text-emerald-600">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-slate-100/50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !description.trim()}
            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/25 disabled:shadow-none"
            data-testid="submit-forum-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Publicando...
              </>
            ) : (
              <>
                <MessageCircle className="w-5 h-5" />
                Crear Tema
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
