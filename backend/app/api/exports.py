"""Export API — CSV, PDF, and Shapefile exports."""

import csv
import io
import os
import tempfile
import zipfile
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.database import get_db
from app.models.boundary import AdminBoundary
from app.models.computed_score import ComputedScore
from app.models.indicator import ClimateIndicator
from app.models.indicator_reference import IndicatorReference
from app.models.indicator_value import IndicatorValue
from app.models.user import User
from app.services.cvi_engine import (
    load_indicator_values,
    load_reference_map,
    normalise_all,
    compute_dimension_scores,
    compute_full_scores,
)

router = APIRouter(prefix="/api/v1/export", tags=["export"])


def safe_float(val):
    if val is None:
        return ""
    if isinstance(val, float) and (val != val or val == float("inf") or val == float("-inf")):
        return ""
    return round(val, 6)


def get_cri_category(cri):
    if cri is None:
        return ""
    if cri < 0.2:
        return "Very Low"
    if cri < 0.4:
        return "Low"
    if cri < 0.6:
        return "Medium"
    if cri < 0.8:
        return "High"
    return "Very High"


# ── CSV Export ──


@router.get("/csv")
async def export_csv(
    level: int = Query(4, ge=1, le=4),
    division_pcode: Optional[str] = Query(None),
    district_pcode: Optional[str] = Query(None),
    upazila_pcode: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Export risk index data as CSV with all indicator values and computed scores."""
    # Get indicator codes (ordered)
    ind_result = await db.execute(
        select(ClimateIndicator.gis_attribute_id, ClimateIndicator.indicator_name)
        .order_by(ClimateIndicator.component, ClimateIndicator.subcategory, ClimateIndicator.id)
    )
    indicator_rows = [(r.gis_attribute_id, r.indicator_name) for r in ind_result.all() if r.gis_attribute_id]
    indicator_codes = [r[0] for r in indicator_rows]

    # Query boundaries with scores
    query = (
        select(
            AdminBoundary.pcode,
            AdminBoundary.name_en,
            AdminBoundary.division_name,
            AdminBoundary.district_name,
            AdminBoundary.upazila_name,
            ComputedScore.hazard_score,
            ComputedScore.soc_exposure_score,
            ComputedScore.sensitivity_score,
            ComputedScore.adaptive_capacity_score,
            ComputedScore.env_exposure_score,
            ComputedScore.env_sensitivity_score,
            ComputedScore.exposure_score,
            ComputedScore.vulnerability_score,
            ComputedScore.cri_score,
        )
        .outerjoin(ComputedScore, AdminBoundary.pcode == ComputedScore.boundary_pcode)
        .where(AdminBoundary.adm_level == level)
    )

    if division_pcode:
        query = query.where(AdminBoundary.pcode.like(division_pcode[:2] + "%"))
    if district_pcode:
        query = query.where(AdminBoundary.pcode.like(district_pcode[:4] + "%"))
    if upazila_pcode:
        query = query.where(AdminBoundary.parent_pcode == upazila_pcode)

    query = query.order_by(AdminBoundary.pcode)
    result = await db.execute(query)
    boundaries = result.all()

    # Pre-load all indicator values for these boundaries
    pcodes = [b.pcode for b in boundaries]
    iv_result = await db.execute(
        select(
            IndicatorValue.boundary_pcode,
            ClimateIndicator.gis_attribute_id,
            IndicatorValue.value,
        )
        .join(ClimateIndicator, IndicatorValue.indicator_id == ClimateIndicator.id)
        .where(
            IndicatorValue.boundary_pcode.in_(pcodes),
            IndicatorValue.is_deleted == False,
        )
    )
    # Build pcode -> {gis_id: value}
    values_map = {}
    for row in iv_result.all():
        if row.boundary_pcode not in values_map:
            values_map[row.boundary_pcode] = {}
        values_map[row.boundary_pcode][row.gis_attribute_id] = row.value

    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)

    header = [
        "boundary_pcode", "boundary_name", "division", "district", "upazila",
    ] + indicator_codes + [
        "hazard_score", "soc_exposure_score", "sensitivity_score",
        "adaptive_capacity_score", "env_exposure_score", "env_sensitivity_score",
        "exposure_score", "vulnerability_score", "cri_score", "cri_category",
    ]
    writer.writerow(header)

    for b in boundaries:
        iv_vals = values_map.get(b.pcode, {})
        row = [
            b.pcode, b.name_en or "", b.division_name or "",
            b.district_name or "", b.upazila_name or "",
        ]
        for code in indicator_codes:
            val = iv_vals.get(code)
            row.append(val if val is not None else "")
        row.extend([
            safe_float(b.hazard_score),
            safe_float(b.soc_exposure_score),
            safe_float(b.sensitivity_score),
            safe_float(b.adaptive_capacity_score),
            safe_float(b.env_exposure_score),
            safe_float(b.env_sensitivity_score),
            safe_float(b.exposure_score),
            safe_float(b.vulnerability_score),
            safe_float(b.cri_score),
            get_cri_category(b.cri_score),
        ])
        writer.writerow(row)

    output.seek(0)
    filename = f"crvap_export_adm{level}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── PDF Export ──


@router.get("/pdf")
async def export_pdf(
    boundary_pcode: str = Query(...),
    lang: str = Query("en"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a PDF report for a single boundary."""
    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="PDF generation requires reportlab. Install with: pip install reportlab",
        )

    # Load boundary info
    bnd_result = await db.execute(
        select(
            AdminBoundary.name_en,
            AdminBoundary.name_bn,
            AdminBoundary.pcode,
            AdminBoundary.division_name,
            AdminBoundary.district_name,
            AdminBoundary.upazila_name,
        ).where(AdminBoundary.pcode == boundary_pcode)
    )
    boundary = bnd_result.one_or_none()
    if not boundary:
        raise HTTPException(status_code=404, detail="Boundary not found")

    # Load scores
    score_result = await db.execute(
        select(ComputedScore).where(ComputedScore.boundary_pcode == boundary_pcode)
    )
    score = score_result.scalar_one_or_none()

    # Load indicator values
    iv_result = await db.execute(
        select(
            ClimateIndicator.gis_attribute_id,
            ClimateIndicator.indicator_name,
            ClimateIndicator.indicator_name_bn,
            ClimateIndicator.component,
            ClimateIndicator.subcategory,
            IndicatorValue.value,
        )
        .join(ClimateIndicator, IndicatorValue.indicator_id == ClimateIndicator.id)
        .where(
            IndicatorValue.boundary_pcode == boundary_pcode,
            IndicatorValue.is_deleted == False,
        )
        .order_by(ClimateIndicator.component, ClimateIndicator.subcategory, ClimateIndicator.id)
    )
    indicators = iv_result.all()

    # Load references for normalised values
    reference_map = await load_reference_map(db)
    raw_values = await load_indicator_values(db, boundary_pcode)
    normalised = normalise_all(raw_values, reference_map) if raw_values else {}

    # Bilingual labels
    if lang == "bn":
        labels = {
            "title": "\u099c\u09b2\u09ac\u09be\u09af\u09bc\u09c1 \u099d\u09c1\u0981\u0995\u09bf \u0993 \u09a6\u09c1\u09b0\u09cd\u09ac\u09b2\u09a4\u09be \u09ae\u09c2\u09b2\u09cd\u09af\u09be\u09af\u09bc\u09a8 \u09aa\u09cd\u09b2\u09cd\u09af\u09be\u099f\u09ab\u09b0\u09cd\u09ae",
            "area_report": "\u098f\u09b2\u09be\u0995\u09be \u09aa\u09cd\u09b0\u09a4\u09bf\u09ac\u09c7\u09a6\u09a8",
            "cri_label": "\u099c\u09b2\u09ac\u09be\u09af\u09bc\u09c1 \u099d\u09c1\u0981\u0995\u09bf \u09b8\u09c2\u099a\u0995 (\u09b8\u09bf\u0986\u09b0\u0986\u0987)",
            "dimension": "\u09ae\u09be\u09a4\u09cd\u09b0\u09be",
            "score": "\u09b8\u09cd\u0995\u09cb\u09b0",
            "hazard": "\u09ac\u09bf\u09aa\u09a6",
            "soc_exposure": "\u09b8\u09be\u09ae\u09be\u099c\u09bf\u0995 \u09b8\u0982\u09b8\u09cd\u09aa\u09b0\u09cd\u09b6",
            "sensitivity": "\u09b8\u0982\u09ac\u09c7\u09a6\u09a8\u09b6\u09c0\u09b2\u09a4\u09be",
            "adaptive_capacity": "\u0985\u09ad\u09bf\u09af\u09cb\u099c\u09a8 \u09b8\u0995\u09cd\u09b7\u09ae\u09a4\u09be",
            "env_exposure": "\u09aa\u09b0\u09bf\u09ac\u09c7\u09b6\u0997\u09a4 \u09b8\u0982\u09b8\u09cd\u09aa\u09b0\u09cd\u09b6",
            "env_sensitivity": "\u09aa\u09b0\u09bf\u09ac\u09c7\u09b6\u0997\u09a4 \u09b8\u0982\u09ac\u09c7\u09a6\u09a8\u09b6\u09c0\u09b2\u09a4\u09be",
            "combined_exposure": "\u09b8\u09ae\u09cd\u09ae\u09bf\u09b2\u09bf\u09a4 \u09b8\u0982\u09b8\u09cd\u09aa\u09b0\u09cd\u09b6",
            "vulnerability": "\u09a6\u09c1\u09b0\u09cd\u09ac\u09b2\u09a4\u09be",
            "indicator_values": "\u09b8\u09c2\u099a\u0995 \u09ae\u09be\u09a8",
            "indicator": "\u09b8\u09c2\u099a\u0995",
            "code": "\u0995\u09cb\u09a1",
            "component": "\u0989\u09aa\u09be\u09a6\u09be\u09a8",
            "raw_value": "\u0995\u09be\u0981\u099a\u09be \u09ae\u09be\u09a8",
            "normalised": "\u09b8\u09cd\u09ac\u09be\u09ad\u09be\u09ac\u09bf\u0995\u09c0\u0995\u09c3\u09a4",
            "very_low": "\u0985\u09a4\u09bf \u09a8\u09bf\u09ae\u09cd\u09a8",
            "low": "\u09a8\u09bf\u09ae\u09cd\u09a8",
            "medium": "\u09ae\u09be\u099d\u09be\u09b0\u09bf",
            "high": "\u0989\u099a\u09cd\u099a",
            "very_high": "\u0985\u09a4\u09bf \u0989\u099a\u09cd\u099a",
            "footer": "\u09b8\u09bf\u0986\u09b0\u09ad\u09bf\u098f\u09aa\u09bf \u09a6\u09cd\u09ac\u09be\u09b0\u09be \u09a4\u09c8\u09b0\u09bf",
            "no_scores": "\u098f\u0987 \u09b8\u09c0\u09ae\u09be\u09a8\u09be\u09b0 \u099c\u09a8\u09cd\u09af \u0995\u09cb\u09a8\u09cb \u0997\u09a3\u09a8\u09be\u0995\u09c3\u09a4 \u09b8\u09cd\u0995\u09cb\u09b0 \u09a8\u09c7\u0987\u0964",
        }
    else:
        labels = {
            "title": "Climate Risk & Vulnerability Assessment Platform",
            "area_report": "Area Report",
            "cri_label": "Climate Risk Index (CRI)",
            "dimension": "Dimension",
            "score": "Score",
            "hazard": "Hazard",
            "soc_exposure": "Soc. Exposure",
            "sensitivity": "Sensitivity",
            "adaptive_capacity": "Adaptive Capacity",
            "env_exposure": "Env. Exposure",
            "env_sensitivity": "Env. Sensitivity",
            "combined_exposure": "Combined Exposure",
            "vulnerability": "Vulnerability",
            "indicator_values": "Indicator Values",
            "indicator": "Indicator",
            "code": "Code",
            "component": "Component",
            "raw_value": "Raw Value",
            "normalised": "Normalised",
            "very_low": "Very Low",
            "low": "Low",
            "medium": "Medium",
            "high": "High",
            "very_high": "Very High",
            "footer": "Generated by CRVAP",
            "no_scores": "No computed scores available for this boundary.",
        }

    def get_cri_category_label(cri):
        if cri is None:
            return ""
        if cri < 0.2:
            return labels["very_low"]
        if cri < 0.4:
            return labels["low"]
        if cri < 0.6:
            return labels["medium"]
        if cri < 0.8:
            return labels["high"]
        return labels["very_high"]

    # Determine area name based on language
    if lang == "bn":
        area_name = boundary.name_bn or boundary.name_en
    else:
        area_name = boundary.name_en

    # Register Bengali font if needed (best-effort)
    bn_font_name = None
    if lang == "bn":
        try:
            from reportlab.pdfbase import pdfmetrics
            from reportlab.pdfbase.ttfonts import TTFont
            noto_path = os.path.join(os.path.dirname(__file__), "..", "fonts", "NotoSansBengali-Regular.ttf")
            if os.path.exists(noto_path):
                pdfmetrics.registerFont(TTFont("NotoSansBengali", noto_path))
                bn_font_name = "NotoSansBengali"
        except Exception:
            pass  # Fall back to default font

    # Build PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20 * mm, bottomMargin=15 * mm)

    styles = getSampleStyleSheet()
    font_kwargs = {"fontName": bn_font_name} if bn_font_name else {}
    title_style = ParagraphStyle("Title2", parent=styles["Title"], fontSize=16, spaceAfter=6, **font_kwargs)
    subtitle_style = ParagraphStyle("Subtitle2", parent=styles["Normal"], fontSize=10, textColor=colors.gray, **font_kwargs)
    heading_style = ParagraphStyle("Heading", parent=styles["Heading2"], fontSize=12, spaceBefore=12, **font_kwargs)

    elements = []

    # Header
    elements.append(Paragraph(labels["title"], title_style))
    breadcrumb = " > ".join(
        filter(None, [boundary.division_name, boundary.district_name, boundary.upazila_name, area_name])
    )
    elements.append(Paragraph(f"{labels['area_report']}: {breadcrumb}", subtitle_style))
    elements.append(Paragraph(f"PCODE: {boundary.pcode}", subtitle_style))
    elements.append(Spacer(1, 10 * mm))

    # CRI Score
    if score and score.cri_score is not None:
        cri_val = round(score.cri_score, 3)
        category = get_cri_category_label(score.cri_score)
        elements.append(Paragraph(f"{labels['cri_label']}: {cri_val} - {category}", heading_style))

        # Dimension scores table
        dim_data = [
            [labels["dimension"], labels["score"]],
            [labels["hazard"], f"{score.hazard_score:.3f}" if score.hazard_score else "N/A"],
            [labels["soc_exposure"], f"{score.soc_exposure_score:.3f}" if score.soc_exposure_score else "N/A"],
            [labels["sensitivity"], f"{score.sensitivity_score:.3f}" if score.sensitivity_score else "N/A"],
            [labels["adaptive_capacity"], f"{score.adaptive_capacity_score:.3f}" if score.adaptive_capacity_score else "N/A"],
            [labels["env_exposure"], f"{score.env_exposure_score:.3f}" if score.env_exposure_score else "N/A"],
            [labels["env_sensitivity"], f"{score.env_sensitivity_score:.3f}" if score.env_sensitivity_score else "N/A"],
            [labels["combined_exposure"], f"{score.exposure_score:.3f}" if score.exposure_score else "N/A"],
            [labels["vulnerability"], f"{score.vulnerability_score:.3f}" if score.vulnerability_score else "N/A"],
            ["CRI", f"{score.cri_score:.3f}" if score.cri_score else "N/A"],
        ]
        dim_table = Table(dim_data, colWidths=[120 * mm, 40 * mm])
        dim_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B4F72")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
        ]))
        if bn_font_name:
            dim_table.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), bn_font_name)]))
        elements.append(dim_table)
    else:
        elements.append(Paragraph(labels["no_scores"], styles["Normal"]))

    elements.append(Spacer(1, 8 * mm))

    # Raw indicator values table
    if indicators:
        elements.append(Paragraph(labels["indicator_values"], heading_style))
        ind_data = [[labels["indicator"], labels["code"], labels["component"], labels["raw_value"], labels["normalised"]]]
        for ind in indicators:
            norm_info = normalised.get(ind.gis_attribute_id, {})
            norm_val = norm_info.get("normalised_value")
            norm_str = f"{norm_val:.3f}" if norm_val is not None else "N/A"
            if lang == "bn":
                ind_name = (ind.indicator_name_bn or ind.indicator_name)[:40]
            else:
                ind_name = ind.indicator_name[:40]
            ind_data.append([
                ind_name,
                ind.gis_attribute_id or "",
                ind.component or "",
                f"{ind.value}",
                norm_str,
            ])

        ind_table = Table(ind_data, colWidths=[55 * mm, 25 * mm, 30 * mm, 25 * mm, 25 * mm])
        ind_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B4F72")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F5F5")]),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ]))
        if bn_font_name:
            ind_table.setStyle(TableStyle([("FONTNAME", (0, 0), (-1, -1), bn_font_name)]))
        elements.append(ind_table)

    elements.append(Spacer(1, 8 * mm))

    # Footer
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    footer_style = ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7, textColor=colors.gray, **font_kwargs)
    elements.append(Paragraph(
        f"{labels['footer']} on {now}. Data may be subject to updates.",
        footer_style,
    ))

    doc.build(elements)
    buffer.seek(0)

    filename = f"CRVAP_Report_{boundary.pcode}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.pdf"
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Shapefile Export ──


@router.get("/shapefile")
async def export_shapefile(
    level: int = Query(4, ge=1, le=4),
    indicator: str = Query("cri"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("admin")),
):
    """Export boundaries with scores as a Shapefile (admin only)."""
    try:
        import fiona
        from fiona.crs import from_epsg
        import json as json_mod
        from shapely.geometry import shape, mapping
        from sqlalchemy import func
    except ImportError:
        raise HTTPException(
            status_code=501,
            detail="Shapefile export requires fiona and shapely.",
        )

    from sqlalchemy import func as sa_func

    # Query boundaries with scores + geometry as GeoJSON
    query = (
        select(
            AdminBoundary.pcode,
            AdminBoundary.name_en,
            sa_func.ST_AsGeoJSON(AdminBoundary.geom).label("geojson"),
            ComputedScore.hazard_score,
            ComputedScore.soc_exposure_score,
            ComputedScore.sensitivity_score,
            ComputedScore.adaptive_capacity_score,
            ComputedScore.exposure_score,
            ComputedScore.vulnerability_score,
            ComputedScore.cri_score,
        )
        .outerjoin(ComputedScore, AdminBoundary.pcode == ComputedScore.boundary_pcode)
        .where(AdminBoundary.adm_level == level)
        .where(AdminBoundary.geom.isnot(None))
        .order_by(AdminBoundary.pcode)
    )
    result = await db.execute(query)
    rows = result.all()

    if not rows:
        raise HTTPException(status_code=404, detail="No boundaries found at this level")

    # Write shapefile to temp dir
    tmpdir = tempfile.mkdtemp()
    shp_path = os.path.join(tmpdir, "crvap_export")

    schema = {
        "geometry": "MultiPolygon",
        "properties": {
            "pcode": "str",
            "name_en": "str",
            "hazard": "float",
            "soc_exp": "float",
            "sensitiv": "float",
            "adapt_cap": "float",
            "exposure": "float",
            "vulnerab": "float",
            "cri": "float",
        },
    }

    with fiona.open(
        shp_path + ".shp",
        "w",
        driver="ESRI Shapefile",
        crs=from_epsg(4326),
        schema=schema,
    ) as dst:
        for row in rows:
            if not row.geojson:
                continue
            geom = json_mod.loads(row.geojson)
            # Ensure MultiPolygon
            geom_shape = shape(geom)
            if geom_shape.geom_type == "Polygon":
                from shapely.geometry import MultiPolygon
                geom_shape = MultiPolygon([geom_shape])

            dst.write({
                "geometry": mapping(geom_shape),
                "properties": {
                    "pcode": row.pcode,
                    "name_en": row.name_en or "",
                    "hazard": float(row.hazard_score) if row.hazard_score else None,
                    "soc_exp": float(row.soc_exposure_score) if row.soc_exposure_score else None,
                    "sensitiv": float(row.sensitivity_score) if row.sensitivity_score else None,
                    "adapt_cap": float(row.adaptive_capacity_score) if row.adaptive_capacity_score else None,
                    "exposure": float(row.exposure_score) if row.exposure_score else None,
                    "vulnerab": float(row.vulnerability_score) if row.vulnerability_score else None,
                    "cri": float(row.cri_score) if row.cri_score else None,
                },
            })

    # ZIP the shapefile components
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for ext in [".shp", ".shx", ".dbf", ".prj", ".cpg"]:
            fpath = shp_path + ext
            if os.path.exists(fpath):
                zf.write(fpath, f"crvap_export{ext}")

    # Cleanup temp files
    for ext in [".shp", ".shx", ".dbf", ".prj", ".cpg"]:
        fpath = shp_path + ext
        if os.path.exists(fpath):
            os.remove(fpath)
    os.rmdir(tmpdir)

    zip_buffer.seek(0)
    filename = f"crvap_shapefile_adm{level}_{datetime.now(timezone.utc).strftime('%Y%m%d')}.zip"
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
