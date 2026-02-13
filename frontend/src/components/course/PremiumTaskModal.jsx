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
  PenTool, X, Calendar, Clock, Upload, FileText,
  AlertCircle, Loader2, Check, Type, Layers, Eye, EyeOff,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, Link as LinkIcon, Highlighter,
  File as FileIcon
} from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Rich Text Editor Component
function RichTextEditor({ value, onChange, placeholder }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
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
        active ? "bg-amber-100 text-amber-700" : "hover:bg-slate-100 text-slate-500"
      }`}
      title={title}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="border-2 border-slate-200 rounded-xl overflow-hidden focus-within:border-amber-400 transition-colors bg-white">
      {/* Toolbar */}
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

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}

// Time Picker Component
export function TaskTimePicker({ value, onChange, label }) {
  const [isOpen, setIsOpen] = useState(false);
  const [hours, setHours] = useState(value ? parseInt(value.split(':')[0]) : 23);
  const [minutes, setMinutes] = useState(value ? parseInt(value.split(':')[1]) : 59);
  const [seconds, setSeconds] = useState(value && value.split(':')[2] ? parseInt(value.split(':')[2]) : 0);
  const [selectingMode, setSelectingMode] = useState('hours');
  const dialRef = useRef(null);
  
  useEffect(() => {
    if (value) {
      const parts = value.split(':');
      setHours(parseInt(parts[0]) || 0);
      setMinutes(parseInt(parts[1]) || 0);
      setSeconds(parseInt(parts[2]) || 0);
    }
  }, [value]);
  
  const handleDialClick = (e) => {
    if (!dialRef.current) return;
    
    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const x = e.clientX - rect.left - centerX;
    const y = e.clientY - rect.top - centerY;
    
    let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
    if (angle < 0) angle += 360;
    
    if (selectingMode === 'hours') {
      const hour = Math.round(angle / 30) % 12 || 12;
      setHours(hour > 12 ? hour - 12 : hour);
    } else if (selectingMode === 'minutes') {
      const minute = Math.round(angle / 6) % 60;
      setMinutes(minute);
    } else {
      const second = Math.round(angle / 6) % 60;
      setSeconds(second);
    }
  };
  
  const confirmTime = () => {
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    onChange(timeStr);
    setIsOpen(false);
  };
  
  const goNext = () => {
    if (selectingMode === 'hours') setSelectingMode('minutes');
    else if (selectingMode === 'minutes') setSelectingMode('seconds');
  };
  
  const hourNumbers = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minuteSecondNumbers = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  
  const currentNumbers = selectingMode === 'hours' ? hourNumbers : minuteSecondNumbers;
  const currentValue = selectingMode === 'hours' ? hours : selectingMode === 'minutes' ? minutes : seconds;
  const currentAngle = selectingMode === 'hours' 
    ? (hours % 12) * 30 
    : selectingMode === 'minutes' 
      ? minutes * 6 
      : seconds * 6;
  
  const displayTime = value || "23:59:00";
  
  return (
    <div className="relative">
      {label && (
        <label className="block text-sm font-semibold text-slate-700 mb-2">{label}</label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-left flex items-center gap-3 hover:border-amber-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
        data-testid="task-time-picker-btn"
      >
        <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <span className="text-slate-800 font-semibold text-lg">
          {displayTime}
        </span>
      </button>
      
      {isOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden w-[340px] animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 px-6 py-5">
              <p className="text-amber-100 text-sm mb-1 font-medium">Seleccionar hora límite</p>
              <div className="flex items-baseline gap-1 justify-center">
                <button
                  type="button"
                  onClick={() => setSelectingMode('hours')}
                  className={`text-4xl font-light transition-all ${selectingMode === 'hours' ? 'text-white scale-110' : 'text-white/50'}`}
                >
                  {hours.toString().padStart(2, '0')}
                </button>
                <span className="text-4xl font-light text-white/50">:</span>
                <button
                  type="button"
                  onClick={() => setSelectingMode('minutes')}
                  className={`text-4xl font-light transition-all ${selectingMode === 'minutes' ? 'text-white scale-110' : 'text-white/50'}`}
                >
                  {minutes.toString().padStart(2, '0')}
                </button>
                <span className="text-4xl font-light text-white/50">:</span>
                <button
                  type="button"
                  onClick={() => setSelectingMode('seconds')}
                  className={`text-4xl font-light transition-all ${selectingMode === 'seconds' ? 'text-white scale-110' : 'text-white/50'}`}
                >
                  {seconds.toString().padStart(2, '0')}
                </button>
              </div>
            </div>
            
            <div className="p-6 bg-gradient-to-b from-slate-50 to-white">
              <div 
                ref={dialRef}
                onClick={handleDialClick}
                className="relative w-[240px] h-[240px] mx-auto rounded-full bg-white shadow-inner border border-slate-200 cursor-pointer"
              >
                <div 
                  className="absolute z-5"
                  style={{
                    width: '3px',
                    height: '80px',
                    left: '50%',
                    top: '50%',
                    marginLeft: '-1.5px',
                    marginTop: '-80px',
                    background: 'linear-gradient(to bottom, #ea580c, #f59e0b)',
                    transformOrigin: 'bottom center',
                    transform: `rotate(${currentAngle}deg)`,
                    borderRadius: '3px'
                  }}
                />
                
                <div 
                  className="absolute w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-500 z-5 shadow-lg flex items-center justify-center"
                  style={{
                    left: `calc(50% + ${80 * Math.sin(currentAngle * Math.PI / 180)}px)`,
                    top: `calc(50% - ${80 * Math.cos(currentAngle * Math.PI / 180)}px)`,
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <span className="text-white text-xs font-bold">
                    {selectingMode === 'hours' 
                      ? (hours === 0 ? 12 : hours > 12 ? hours - 12 : hours) 
                      : currentValue.toString().padStart(2, '0')
                    }
                  </span>
                </div>
                
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full z-20 shadow-lg" />
                
                {currentNumbers.map((num, idx) => {
                  const angle = (idx * 30 - 90) * (Math.PI / 180);
                  const radius = 90;
                  const x = 120 + radius * Math.cos(angle);
                  const y = 120 + radius * Math.sin(angle);
                  const isSelected = selectingMode === 'hours' 
                    ? (num === hours || (num === 12 && hours === 0)) 
                    : num === currentValue;
                  
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectingMode === 'hours') {
                          setHours(num === 12 ? 0 : num);
                        } else if (selectingMode === 'minutes') {
                          setMinutes(num);
                        } else {
                          setSeconds(num);
                        }
                      }}
                      className={`absolute w-10 h-10 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                        isSelected 
                          ? 'text-transparent' 
                          : 'hover:bg-amber-100 text-slate-700'
                      }`}
                      style={{ left: x, top: y }}
                    >
                      {selectingMode === 'hours' ? num : num.toString().padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
              
              <div className="flex justify-center mt-4 gap-2">
                <button
                  onClick={() => setSelectingMode('hours')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'hours' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Horas
                </button>
                <button
                  onClick={() => setSelectingMode('minutes')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'minutes' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Minutos
                </button>
                <button
                  onClick={() => setSelectingMode('seconds')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${selectingMode === 'seconds' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}
                >
                  Segundos
                </button>
              </div>
            </div>
            
            <div className="px-6 pb-6 flex justify-end gap-3 bg-white">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-5 py-2.5 text-slate-600 font-semibold hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={goNext}
                className={`px-5 py-2.5 font-semibold rounded-xl transition-all ${selectingMode !== 'seconds' ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'hidden'}`}
              >
                Siguiente
              </button>
              <button
                type="button"
                onClick={confirmTime}
                className={`px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/25 ${selectingMode === 'seconds' ? '' : 'hidden'}`}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Main Premium Task Modal Component
export default function PremiumTaskModal({ isOpen, onClose, subjectId, token, user, onPostCreated }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryType, setDeliveryType] = useState("text");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("23:59:00");
  const [showToStudents, setShowToStudents] = useState(true);
  const [points, setPoints] = useState("");
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
      setDeliveryType("text");
      setDueDate("");
      setDueTime("23:59");
      setShowToStudents(true);
      setPoints("");
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
      setError("El título es requerido");
      return;
    }
    
    if (!dueDate) {
      setError("La fecha de entrega es requerida");
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
      
      const dueDateTime = `${dueDate}T${dueTime}:00`;
      
      const res = await axios.post(`${API}/course/${subjectId}/posts`, {
        subject_id: subjectId,
        title: title.trim(),
        content: description.trim() || `Tipo de entrega: ${deliveryType === 'text' ? 'Texto en línea' : deliveryType === 'files' ? 'Archivos' : 'Texto y archivos'}${points ? ` | Puntos: ${points}` : ''}${!showToStudents ? ' | (Oculto para estudiantes)' : ''}\n\nFecha de entrega: ${new Date(dueDateTime).toLocaleString('es-PE', { dateStyle: 'long', timeStyle: 'short' })}`,
        post_type: "task",
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        metadata: {
          delivery_type: deliveryType,
          due_date: dueDateTime,
          show_to_students: showToStudents,
          points: points ? parseInt(points) : null
        }
      }, { headers });
      
      onPostCreated(res.data.post);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || 'Error al crear la tarea');
    } finally {
      setSubmitting(false);
      setUploadProgress(0);
    }
  };
  
  if (!isOpen) return null;
  
  const today = new Date().toISOString().split('T')[0];
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-orange-500 to-red-500" />
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTRoLTEydjJoMTJ2LTJ6bTAtNGgtMTJ2MmgxMnYtMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
          
          <div className="relative px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                <PenTool className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Nueva Tarea</h2>
                <p className="text-sm text-white/80">Asigna una actividad a tus estudiantes</p>
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
        
        <div className="p-6 max-h-[65vh] overflow-y-auto custom-scroll">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
          
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Título de la tarea <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej: Análisis del capítulo 5"
              className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
              data-testid="task-title-input"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Fecha de entrega <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={today}
                  className="w-full px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
                  data-testid="task-date-input"
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <TaskTimePicker
                value={dueTime}
                onChange={setDueTime}
                label="Hora límite"
              />
            </div>
          </div>
          
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Tipo de entrega
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'text', label: 'Texto en línea', icon: Type, desc: 'Respuesta escrita' },
                { id: 'files', label: 'Archivos', icon: Upload, desc: 'Subir documentos' },
                { id: 'both', label: 'Ambos', icon: Layers, desc: 'Texto y archivos' }
              ].map((type) => {
                const TypeIcon = type.icon;
                const isSelected = deliveryType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setDeliveryType(type.id)}
                    className={`p-4 rounded-xl border-2 transition-all text-left ${
                      isSelected 
                        ? 'border-amber-400 bg-amber-50 shadow-md' 
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    data-testid={`delivery-type-${type.id}`}
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${
                      isSelected ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <TypeIcon className="w-5 h-5" />
                    </div>
                    <p className={`font-semibold text-sm ${isSelected ? 'text-amber-700' : 'text-slate-700'}`}>
                      {type.label}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{type.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
          
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Puntos <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <div className="relative w-32">
              <input
                type="number"
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                placeholder="100"
                min="0"
                max="1000"
                className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-slate-800 font-medium placeholder:text-slate-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-all"
                data-testid="task-points-input"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">pts</span>
            </div>
          </div>
          
          <div className="mb-5 p-4 bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${showToStudents ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
                  {showToStudents ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-700">Mostrar a estudiantes</p>
                  <p className="text-xs text-slate-400">
                    {showToStudents ? 'Los estudiantes podrán ver esta tarea' : 'Solo visible para profesores'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowToStudents(!showToStudents)}
                className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
                  showToStudents ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                data-testid="task-visibility-toggle"
              >
                <span className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-200 ${
                  showToStudents ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>
          </div>
          
          <div className="mb-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Instrucciones
            </label>
            <RichTextEditor
              value={description}
              onChange={setDescription}
              placeholder="Describe las instrucciones y requisitos de la tarea..."
            />
          </div>
          
          <div className="mb-2">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Adjuntar material <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            
            {file ? (
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-200 flex items-center gap-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <FileIcon className="w-6 h-6 text-amber-600" />
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
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:border-amber-400 hover:bg-amber-50/30 transition-all group">
                <div className="w-14 h-14 bg-slate-100 group-hover:bg-amber-100 rounded-xl flex items-center justify-center mb-3 transition-colors">
                  <Upload className="w-7 h-7 text-slate-400 group-hover:text-amber-600 transition-colors" />
                </div>
                <p className="text-sm font-semibold text-slate-600 group-hover:text-amber-700">Arrastra o haz clic para subir</p>
                <p className="text-xs text-slate-400 mt-1">PDF, Word, Excel, PowerPoint hasta 25MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
                />
              </label>
            )}
          </div>
          
          {submitting && uploadProgress > 0 && (
            <div className="mt-4 p-4 bg-amber-50 rounded-xl border border-amber-200">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium text-amber-700">Subiendo archivo...</span>
                <span className="font-bold text-amber-600">{uploadProgress}%</span>
              </div>
              <div className="h-2 bg-amber-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        
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
            disabled={submitting || !title.trim() || !dueDate}
            className="px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-300 disabled:to-slate-400 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg shadow-amber-500/25 disabled:shadow-none"
            data-testid="submit-task-btn"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Creando...
              </>
            ) : (
              <>
                <Check className="w-5 h-5" />
                Crear Tarea
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
