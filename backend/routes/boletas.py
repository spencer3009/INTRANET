"""
Boleta de Venta Interna - Endpoints
Handles emisor config, boleta emission, PDF download, and annulment.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
import re
import uuid
import logging

from routes.core import (
    db, get_current_user, resolve_user_from_token, is_admin_user,
    require_section_access, now_iso
)
from services.boleta_pdf_generator import generar_boleta_pdf, monto_en_letras

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contabilidad")

# ══════════════════════════════════════════════════════════════════════════════
# BOLETA EMISOR CONFIG
# ══════════════════════════════════════════════════════════════════════════════

class BoletaConfigUpdate(BaseModel):
    razon_social: Optional[str] = None
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    distrito: Optional[str] = None
    provincia: Optional[str] = None
    departamento: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    serie: Optional[str] = None
    pie_pagina: Optional[str] = None


def validate_ruc(ruc: str) -> bool:
    """Validate Peruvian RUC: 11 digits, starts with 10 or 20."""
    if not ruc or not re.match(r'^(10|20)\d{9}$', ruc):
        return False
    return True


@router.get("/boleta-config")
async def get_boleta_config(current_user=Depends(require_section_access("accounting"))):
    """Get boleta emisor config for the school."""
    school_id = current_user["school_id"]
    config = await db.boleta_emisor_config.find_one({"school_id": school_id}, {"_id": 0})
    if not config:
        return {
            "school_id": school_id,
            "configured": False,
            "razon_social": "",
            "ruc": "",
            "direccion": "",
            "distrito": "",
            "provincia": "",
            "departamento": "",
            "telefono": "",
            "email": "",
            "serie": "B001",
            "correlativo_actual": 0,
            "pie_pagina": "",
        }
    config["configured"] = True
    return config


@router.put("/boleta-config")
async def update_boleta_config(
    data: BoletaConfigUpdate,
    current_user=Depends(require_section_access("accounting"))
):
    """Create or update boleta emisor config."""
    user = current_user
    school_id = user["school_id"]
    role = user.get("role", "")
    is_owner = user.get("is_owner", False)
    if role not in ("owner", "director", "admin") and not is_owner:
        raise HTTPException(status_code=403, detail="Solo administradores pueden configurar boletas")

    update_data = {k: v for k, v in data.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No hay datos para actualizar")

    # Validate RUC if provided
    if "ruc" in update_data:
        if not validate_ruc(update_data["ruc"]):
            raise HTTPException(status_code=400, detail="RUC invalido. Debe tener 11 digitos y empezar con 10 o 20")

    # Validate serie if provided
    if "serie" in update_data:
        serie = update_data["serie"].strip().upper()
        if not re.match(r'^[A-Z0-9]{1,4}$', serie):
            raise HTTPException(status_code=400, detail="Serie invalida. Max 4 caracteres alfanumericos")
        update_data["serie"] = serie

    # Validate pie_pagina length
    if "pie_pagina" in update_data and update_data["pie_pagina"] and len(update_data["pie_pagina"]) > 200:
        raise HTTPException(status_code=400, detail="Pie de pagina no puede exceder 200 caracteres")

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    existing = await db.boleta_emisor_config.find_one({"school_id": school_id})
    if existing:
        await db.boleta_emisor_config.update_one(
            {"school_id": school_id},
            {"$set": update_data}
        )
    else:
        # Create new config with defaults
        new_doc = {
            "school_id": school_id,
            "razon_social": "",
            "ruc": "",
            "direccion": "",
            "distrito": "",
            "provincia": "",
            "departamento": "",
            "telefono": "",
            "email": "",
            "serie": "B001",
            "correlativo_actual": 0,
            "pie_pagina": "",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        new_doc.update(update_data)
        await db.boleta_emisor_config.insert_one(new_doc)

    config = await db.boleta_emisor_config.find_one({"school_id": school_id}, {"_id": 0})
    config["configured"] = True
    return config


# ══════════════════════════════════════════════════════════════════════════════
# BOLETA EMISSION & PDF
# ══════════════════════════════════════════════════════════════════════════════

async def emitir_boleta_para_ingreso(payment: dict, school_id: str, user: dict) -> dict:
    """
    Called after a payment is created successfully.
    Creates a boleta_interna record and returns boleta info.
    Returns None if config not available.
    """
    config = await db.boleta_emisor_config.find_one({"school_id": school_id})
    if not config or not config.get("ruc") or not config.get("razon_social"):
        return None

    # Check if boleta already exists for this ingreso
    existing = await db.boletas_internas.find_one(
        {"ingreso_id": payment["id"], "school_id": school_id},
        {"_id": 0, "numero_completo": 1}
    )
    if existing:
        return {"boleta_id": existing.get("id"), "numero_boleta": existing["numero_completo"]}

    # Atomic increment of correlativo
    from pymongo import ReturnDocument
    updated_config = await db.boleta_emisor_config.find_one_and_update(
        {"school_id": school_id},
        {
            "$inc": {"correlativo_actual": 1},
            "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}
        },
        return_document=ReturnDocument.AFTER
    )

    serie = updated_config.get("serie", "B001")
    correlativo = updated_config["correlativo_actual"]
    numero_completo = f"{serie}-{correlativo:08d}"

    # Get student info
    student = await db.users.find_one(
        {"id": payment.get("student_id"), "school_id": school_id},
        {"_id": 0, "id": 1, "name": 1, "last_name": 1, "dni": 1, "parent_id": 1, "padre_id": 1, "grado_id": 1, "seccion_id": 1}
    )

    estudiante_nombre = ""
    cliente_nombre = ""
    cliente_dni = ""
    grado_seccion = ""

    if student:
        estudiante_nombre = f"{student.get('name', '')} {student.get('last_name', '')}".strip()

        # Try to get parent info
        parent_id = student.get("parent_id") or student.get("padre_id")
        if parent_id:
            parent = await db.users.find_one(
                {"id": parent_id},
                {"_id": 0, "name": 1, "last_name": 1, "dni": 1}
            )
            if parent:
                cliente_nombre = f"{parent.get('name', '')} {parent.get('last_name', '')}".strip()
                cliente_dni = parent.get("dni", "") or ""

        if not cliente_nombre:
            cliente_nombre = estudiante_nombre
            cliente_dni = student.get("dni", "") or ""

        # Get grade/section names
        grade = await db.grades.find_one({"id": student.get("grado_id")}, {"_id": 0, "nombre": 1, "nivel_nombre": 1})
        section = await db.sections.find_one({"id": student.get("seccion_id")}, {"_id": 0, "nombre": 1})
        if grade:
            grado_seccion = f"{grade.get('nivel_nombre', '')} - {grade.get('nombre', '')}"
            if section:
                grado_seccion += f" {section.get('nombre', '')}"

    # Concept labels
    CONCEPT_LABELS = {
        "matricula": "Matricula", "Matricula": "Matricula",
        "mensualidad": "Pension Escolar", "Mensualidad": "Pension Escolar",
        "taller": "Taller", "uniforme": "Uniforme",
        "material": "Material Escolar", "evento": "Evento", "otros": "Otros"
    }
    concepto_label = CONCEPT_LABELS.get(payment.get("concept", ""), payment.get("concept", "Pago"))

    # Month label
    MONTH_NAMES = {
        "01": "Enero", "02": "Febrero", "03": "Marzo", "04": "Abril",
        "05": "Mayo", "06": "Junio", "07": "Julio", "08": "Agosto",
        "09": "Septiembre", "10": "Octubre", "11": "Noviembre", "12": "Diciembre"
    }
    mes_label = ""
    pension_month = payment.get("pension_month", "")
    if pension_month and len(pension_month) >= 7:
        month_num = pension_month[5:7]
        year_str = pension_month[:4]
        mes_label = f"{MONTH_NAMES.get(month_num, month_num)} {year_str}"

    # Total en letras
    total = payment.get("total_amount", 0)
    total_letras = monto_en_letras(total)

    # User emisor label
    usuario_emisor = f"{user.get('name', '')} {user.get('last_name', '')}".strip()
    now = datetime.now(timezone.utc)
    usuario_emisor_full = f"{usuario_emisor} - {now.strftime('%d/%m/%Y %I:%M %p')}"

    # Build emisor snapshot - logo comes from school settings, not boleta config
    school_settings = await db.tenant_settings.find_one({"school_id": school_id}, {"_id": 0, "logo_url": 1})
    school_doc = await db.schools.find_one({"id": school_id}, {"_id": 0, "logo_url": 1})
    logo_url = (school_settings or {}).get("logo_url") or (school_doc or {}).get("logo_url")

    emisor_snapshot = {
        "razon_social": config.get("razon_social", ""),
        "ruc": config.get("ruc", ""),
        "direccion": config.get("direccion", ""),
        "distrito": config.get("distrito", ""),
        "provincia": config.get("provincia", ""),
        "departamento": config.get("departamento", ""),
        "telefono": config.get("telefono"),
        "email": config.get("email"),
        "logo_url": logo_url,
        "pie_pagina": config.get("pie_pagina"),
    }

    boleta_id = str(uuid.uuid4())
    monto_base = payment.get("amount_base", 0)
    igv_amount = payment.get("igv_amount", 0)
    igv_applicable = payment.get("igv_applicable", False)

    boleta_doc = {
        "id": boleta_id,
        "school_id": school_id,
        "ingreso_id": payment["id"],
        "numero_completo": numero_completo,
        "serie": serie,
        "correlativo": correlativo,
        "fecha_emision": now.isoformat(),
        "emisor": emisor_snapshot,
        "cliente": {
            "nombre_completo": cliente_nombre,
            "dni": cliente_dni,
            "estudiante_nombre": estudiante_nombre,
            "grado_seccion": grado_seccion,
        },
        "concepto": concepto_label,
        "mes": mes_label,
        "metodo_pago": payment.get("payment_method", "efectivo"),
        "monto_base": monto_base,
        "incluye_igv": igv_applicable,
        "igv": igv_amount,
        "subtotal": monto_base,
        "total": total,
        "total_en_letras": total_letras,
        "usuario_emisor": usuario_emisor_full,
        "anulada": False,
        "fecha_anulacion": None,
        "created_at": now.isoformat(),
    }

    await db.boletas_internas.insert_one(boleta_doc)

    return {
        "boleta_id": boleta_id,
        "numero_boleta": numero_completo,
    }


@router.get("/boletas/{ingreso_id}/pdf")
async def descargar_boleta_pdf(
    ingreso_id: str,
    current_user=Depends(require_section_access("accounting"))
):
    """Generate and download boleta PDF on-demand."""
    school_id = current_user["school_id"]

    boleta = await db.boletas_internas.find_one(
        {"ingreso_id": ingreso_id, "school_id": school_id},
        {"_id": 0}
    )
    if not boleta:
        raise HTTPException(status_code=404, detail="No hay boleta emitida para este ingreso")

    pdf_bytes = generar_boleta_pdf(boleta)

    filename = f"Boleta_{boleta['numero_completo']}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.post("/boletas/{ingreso_id}/anular")
async def anular_boleta(
    ingreso_id: str,
    current_user=Depends(require_section_access("accounting"))
):
    """Mark a boleta as annulled. Next PDF download will have ANULADA watermark."""
    school_id = current_user["school_id"]

    boleta = await db.boletas_internas.find_one(
        {"ingreso_id": ingreso_id, "school_id": school_id}
    )
    if not boleta:
        raise HTTPException(status_code=404, detail="No hay boleta emitida para este ingreso")

    if boleta.get("anulada"):
        return {"message": "La boleta ya esta anulada", "numero_completo": boleta.get("numero_completo")}

    await db.boletas_internas.update_one(
        {"ingreso_id": ingreso_id, "school_id": school_id},
        {"$set": {
            "anulada": True,
            "fecha_anulacion": datetime.now(timezone.utc).isoformat()
        }}
    )

    logger.info(f"Boleta {boleta.get('numero_completo')} anulada by {current_user.get('id')}")

    return {"message": "Boleta anulada correctamente", "numero_completo": boleta.get("numero_completo")}


@router.get("/boletas")
async def listar_boletas(
    page: int = 1,
    limit: int = 50,
    current_user=Depends(require_section_access("accounting"))
):
    """List all boletas for the school."""
    school_id = current_user["school_id"]
    skip = (page - 1) * limit
    total = await db.boletas_internas.count_documents({"school_id": school_id})
    boletas = await db.boletas_internas.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("correlativo", -1).skip(skip).limit(limit).to_list(limit)

    return {
        "boletas": boletas,
        "total": total,
        "page": page,
        "total_pages": (total + limit - 1) // limit if total > 0 else 1,
    }
