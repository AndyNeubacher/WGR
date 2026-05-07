import os
import base64
import cv2
import numpy as np
import requests
import threading
import sys

# Suppress inference package warnings about optional models we don't use
os.environ.setdefault("CORE_MODELS_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_SAM_ENABLED",  "False")
os.environ.setdefault("CORE_MODEL_SAM2_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_SAM3_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_GAZE_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_YOLO_WORLD_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_CLIP_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_GROUNDINGDINO_ENABLED", "False")
os.environ.setdefault("DISABLE_VERSION_CHECK", "True")
os.environ.setdefault("INFERENCE_WARNINGS_DISABLED", "True")
os.environ.setdefault("METRICS_ENABLED", "False")
os.environ.setdefault("PALIGEMMA_ENABLED", "False")
os.environ.setdefault("FLORENCE2_ENABLED", "False")
os.environ.setdefault("QWEN_2_5_ENABLED", "False")
os.environ.setdefault("QWEN_3_ENABLED", "False")
os.environ.setdefault("SMOLVLM2_ENABLED", "False")
os.environ.setdefault("DEPTH_ESTIMATION_ENABLED", "False")
os.environ.setdefault("MOONDREAM2_ENABLED", "False")
os.environ.setdefault("CORE_MODEL_PE_ENABLED", "False")

if getattr(sys, 'frozen', False):
    # Standalone Nuitka build
    _base_dir = os.path.dirname(os.path.abspath(sys.executable))
else:
    # Source execution
    _base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Point the Roboflow/inference caching directory to a local predictable spot for portability
cache_dir = os.path.join(_base_dir, "roboflow_cache")
os.environ.setdefault("MODEL_CACHE_DIR", cache_dir)
os.environ.setdefault("INFERENCE_CACHE_DIR", cache_dir)
os.environ.setdefault("CORE_MODEL_CACHE_DIR", cache_dir)
os.environ.setdefault("ONNXRUNTIME_EXECUTION_PROVIDERS", "[CPUExecutionProvider]")
os.environ.setdefault("MPLBACKEND", "Agg")


def _stub_unused_packages():
    """Pre-populate sys.modules with lightweight stubs for packages excluded
    from the production build via --exclude-module, so that
    'from inference import get_model' skips loading torch, transformers, etc.
    even when those packages are installed in the dev/debug environment."""
    if getattr(sys, 'frozen', False):
        return  # frozen build: rthook_torch_stub.py + --exclude-module handle this

    import types

    def _make_stub(name):
        mod = types.ModuleType(name)
        class _Any:
            def __init__(self, *a, **k): pass
            def __call__(self, *a, **k): return _Any()
            def __getattr__(self, n): return _Any()
            def __getitem__(self, n): return _Any()
            def __setitem__(self, n, v): pass
            def __iter__(self): return iter([])
            def __contains__(self, n): return False
            def __len__(self): return 0
            def __bool__(self): return False
            def __hash__(self): return hash(id(self))
            def __repr__(self): return f"<stub {name}>"
        _any = _Any()
        mod.cuda = types.SimpleNamespace(is_available=lambda: False, device_count=lambda: 0)
        mod.nn = types.SimpleNamespace(Module=_Any, functional=_any, Parameter=_Any, Sequential=_Any)
        mod.Tensor = _Any
        mod.device = _Any
        mod.float32 = None
        mod.float16 = None
        mod.no_grad = lambda: _any
        mod.__version__ = "0.0.0+stub"
        mod.__getattr__ = lambda _: _any
        return mod

    # Mirrors the heavy_excludes list in build_pyinstaller.py.
    # Force-stub even when installed — inference's top-level imports of these
    # packages are skipped, keeping debug startup fast.
    _heavy = [
        "torch", "torch.cuda", "torch.nn", "torch.nn.functional",
        "torch._C", "torch.distributed", "torch._inductor",
        "torch.autograd", "torch.optim", "torch.utils",
        "torch.utils.data", "torch.backends", "torch.backends.cudnn",
        "torchvision", "torchaudio",
        "bitsandbytes",
        "transformers", "tokenizers", "timm", "hf_xet",
        "huggingface_hub.hf_xet",
        "groundingdino",
        "boto3", "botocore", "s3transfer",
        "pandas",
        "matplotlib", "matplotlib.pyplot", "matplotlib.rcsetup",
        "av",
        "h5py", "pypdfium2",
        #"scipy",
    ]
    for _name in _heavy:
        if _name not in sys.modules:
            sys.modules[_name] = _make_stub(_name)

_stub_unused_packages()


# Mock os.symlink on Windows to prevent "[WinError 1314] A required privilege is not held by the client"
import shutil
def mock_symlink(src, dst, *args, **kwargs):
    if os.path.exists(dst):
        return
    if os.path.isdir(src):
        shutil.copytree(src, dst)
    else:
        shutil.copy2(src, dst)
if os.name == 'nt':
    os.symlink = mock_symlink


BLACK = (0, 0, 0)
BLUE = (255, 0, 0)
GREEN = (0, 255, 0)
RED = (0, 0, 255)
WHITE = (255, 255, 255)
CYAN = (255, 255, 0)
MAGENTA = (255, 0, 255)
ORANGE = (0, 165, 255)
SPRINGGREEN = (0, 255, 127)



class ObjDetection:
    def __init__(self, api_key: str, model_id: str, api_url: str = 'https://serverless.roboflow.com', offline_mode: bool = False, use_vision_model: bool = True):
        pass
        self.api_url = api_url
        self.api_key = api_key
        self.model_id = model_id
        self.offline = offline_mode
        self.use_vision_model = use_vision_model

        # Local model (loaded lazily on first offline inference)
        self._local_model = None
        self._is_loading = False
        self._local_model_failed = False
        self._model_loaded_callback = None
        self._closing = False
        self._load_thread = None

        if self.offline and self.use_vision_model:
            self._load_thread = threading.Thread(target=self._load_local_model, daemon=True)
            self._load_thread.start()


    def set_model_loaded_callback(self, callback):
        self._model_loaded_callback = callback


    def Close(self):
        self._closing = True
        if hasattr(self, '_load_thread') and self._load_thread is not None:
            if self._load_thread.is_alive():
                self._load_thread.join(timeout=1.0)


    def _encode_frame(self, frame: np.ndarray) -> str:
        success, buffer = cv2.imencode('.jpg', frame)
        if not success:
            raise ValueError("Could not encode frame as JPEG")
        return base64.b64encode(buffer).decode('utf-8')


    def _load_local_model(self):
        if self._is_loading:
            return
            
        self._is_loading = True
        try:
            print(f"Loading local model '{self.model_id}' ...")
            from inference import get_model
            self._local_model = get_model(self.model_id, api_key=self.api_key)
            print(f"Local model '{self.model_id}' ready")
            
            if self._model_loaded_callback:
                self._model_loaded_callback("VisionModel loaded")
        except Exception as e:
            import traceback
            print(f"Could not load inference: {type(e).__name__}: {e}\n{traceback.format_exc()}")
            self._local_model = None
            self._local_model_failed = True

            if self._model_loaded_callback:
                self._model_loaded_callback("VisionModel failed")
        finally:
            self._is_loading = False


    def _get_all_bboxes(self, image: np.ndarray) -> list:
        if not self.use_vision_model:
            return []

        bboxes = []
        try:
            if self.offline:
                if getattr(self, '_closing', False) or self._local_model is None:
                    if getattr(self, '_local_model_failed', False):
                        return []
                    if not self._is_loading:
                        self._load_thread = threading.Thread(target=self._load_local_model, daemon=True)
                        self._load_thread.start()
                    print("Local model still loading or not available - skipping detection")
                    return []
                
                results = self._local_model.infer(image)
                if not results:
                    return []
                if not isinstance(results, list):
                    results = [results]
                    
                all_preds = []
                for r in results:
                    preds = getattr(r, 'predictions', None)
                    if preds:
                        all_preds.extend(preds)
                        
                for pred in all_preds:
                    x = getattr(pred, 'x', None)
                    y = getattr(pred, 'y', None)
                    w = getattr(pred, 'width', None)
                    h = getattr(pred, 'height', None)
                    cls = getattr(pred, 'class_name', getattr(pred, 'class', ''))
                    conf = getattr(pred, 'confidence', 0.0)
                    if all(v is not None for v in (x, y, w, h)):
                        x0, y0 = int(x - w / 2), int(y - h / 2)
                        x1, y1 = int(x + w / 2), int(y + h / 2)
                        bboxes.append({"bbox": [x0, y0, x1, y1], "class": cls, "confidence": conf})
            else:
                image_b64 = self._encode_frame(image)
                url = f"{self.api_url}/{self.model_id}?api_key={self.api_key}"
                response = requests.post(
                    url,
                    data=image_b64,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    timeout=10,
                )
                response.raise_for_status()
                result = response.json()
                predictions = result.get('predictions', [])
                for pred in predictions:
                    if isinstance(pred, dict):
                        x = pred.get('x')
                        y = pred.get('y')
                        w = pred.get('width')
                        h = pred.get('height')
                        cls = pred.get('class', '')
                        conf = pred.get('confidence', 0.0)
                        if all(v is not None for v in (x, y, w, h)):
                            x0, y0 = int(x - w / 2), int(y - h / 2)
                            x1, y1 = int(x + w / 2), int(y + h / 2)
                            bboxes.append({"bbox": [x0, y0, x1, y1], "class": cls, "confidence": conf})
        except Exception as e:
            print(f"_get_all_bboxes failed: {e}")
            
        return bboxes


    def getBBoxImage(self, image: np.ndarray, class_name: str) -> np.ndarray | None:
        bboxes = self._get_all_bboxes(image)
        for bbox_info in bboxes:
            if bbox_info.get("class") == class_name:
                x0, y0, x1, y1 = bbox_info.get("bbox")
                
                # Ensure coordinates are within image bounds
                h, w = image.shape[:2]
                x0 = max(0, min(x0, w))
                y0 = max(0, min(y0, h))
                x1 = max(0, min(x1, w))
                y1 = max(0, min(y1, h))
                
                if x1 > x0 and y1 > y0:
                    return image[y0:y1, x0:x1]
        return None