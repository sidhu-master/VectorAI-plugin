from pathlib import Path

from PyInstaller.utils.hooks import collect_data_files, collect_submodules


APP_ROOT = Path(SPECPATH)
datas = collect_data_files("ezdxf")
hidden_imports = collect_submodules("ezdxf.addons.drawing") + [
    "matplotlib.backends.backend_qtagg",
]

a = Analysis(
    [str(APP_ROOT / "launcher.py")],
    pathex=[str(APP_ROOT)],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="VectorAI CAD Preview",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    target_arch="arm64",
    argv_emulation=False,
)
collection = COLLECT(
    exe,
    a.binaries,
    a.datas,
    strip=False,
    upx=False,
    name="VectorAI CAD Preview",
)
app = BUNDLE(
    collection,
    name="VectorAI CAD Preview.app",
    icon=str(APP_ROOT / "assets" / "AppIcon.icns"),
    bundle_identifier="com.vectorai.cadpreview",
    info_plist={
        "CFBundleDisplayName": "VectorAI CAD Preview",
        "CFBundleName": "VectorAI CAD Preview",
        "CFBundleShortVersionString": "0.1.0",
        "CFBundleVersion": "1",
        "CFBundleDocumentTypes": [{
            "CFBundleTypeName": "DXF Drawing",
            "CFBundleTypeRole": "Viewer",
            "CFBundleTypeExtensions": ["dxf"],
            "LSHandlerRank": "Alternate",
        }],
        "LSApplicationCategoryType": "public.app-category.graphics-design",
        "NSHighResolutionCapable": True,
    },
)
