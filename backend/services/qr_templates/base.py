from abc import ABC, abstractmethod


# Human labels for the maintenance/administrative sub-role select.
MAINTENANCE_ROLE_LABELS = {
    "limpieza": "Limpieza",
    "vigilancia": "Vigilancia",
    "guardianía": "Guardianía",
    "guardiania": "Guardianía",
    "porteria": "Portería",
    "portería": "Portería",
}


def staff_specify_role_text(user: dict) -> str:
    """Return the per-user 'Especificar rol' text for a staff/maintenance user.
    Uses the free-text custom field when role == 'otro', otherwise the human
    label of the selected maintenance_role."""
    mr = (user.get("maintenance_role") or "").strip()
    custom = (user.get("maintenance_role_custom") or "").strip()
    if custom:
        return custom
    if mr and mr != "otro":
        return MAINTENANCE_ROLE_LABELS.get(mr, mr.capitalize())
    return ""


def compute_staff_band_text(user: dict, mode: str, band_texts: dict, default_label: str) -> str:
    """Resolve the yellow-band text for a staff carnet.
    mode: 'default' | 'specify_role' | 'custom'. Always falls back to
    default_label so the band is never empty."""
    mode = mode or "default"
    if mode == "custom" and band_texts:
        txt = (band_texts.get(user.get("id")) or "").strip()
        if txt:
            return txt
    if mode == "specify_role":
        txt = staff_specify_role_text(user)
        if txt:
            return txt
    return default_label


class BaseQRTemplate(ABC):
    template_id: str = ""
    display_name: str = ""
    description: str = ""
    supports_custom_colors: bool = False
    default_color_principal: str = "#1e3a5f"
    default_color_acento: str = "#f5b800"

    @abstractmethod
    async def generate_pdf(self, db, school_id, data, user, limit=None,
                           color_principal: str = None, color_acento: str = None) -> bytes:
        """Generate PDF bytes. color_principal/color_acento used by templates with supports_custom_colors=True."""
        pass
